---
phase: 02-data-integrity
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/integrations/supabase/hooks/useUserImages.ts
  - src/pages/Generator.tsx
  - supabase/functions/_shared/fal-adapter.ts
  - supabase/functions/_shared/vertex-auth.ts
  - supabase/functions/generate-image/index.ts
findings:
  critical: 8
  warning: 11
  info: 4
  total: 23
status: fixed
fixed_at: 2026-05-09T01:00:00Z
fixes_applied: 19
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files spanning the full image generation pipeline were reviewed: a React hook for image metadata and URL signing, the main Generator page component, the Vertex AI generation adapter, the Google OAuth2 JWT helper, and the primary Edge Function. The implementation is architecturally ambitious — durable jobs, parallel workers, atomic task claiming — but eight critical defects were found. Highlights: an unauthenticated diagnostic endpoint that leaks the GCP project ID and burns provider quota; a non-atomic credit check+deduction that creates a revenue-leak window under parallel workers; a missing ownership check on the reconcile action allowing any authenticated user to drain another user's credits; a `base64url` implementation that will stack-overflow on large inputs; and several silent-failure paths where job creation errors are swallowed and generation proceeds against non-existent DB records. Eleven quality warnings and four informational findings follow.

---

## Critical Issues

### CR-01: Unauthenticated health-check endpoint leaks GCP project ID and burns Vertex quota

**File:** `supabase/functions/generate-image/index.ts:153-162`
**Issue:** The `?action=health` route executes before the `Authorization` header check (which starts at line 169). Any unauthenticated caller can trigger a live Vertex AI API call, receive the GCP project ID, region, and model name in the JSON response, and force unbounded quota consumption with no audit trail. If Vertex returns an error, up to 300 characters of billing/permission error text are included in the response.
**Fix:**
```typescript
// Move this block AFTER the auth check, or require a separate admin secret:
if (url.searchParams.get("action") === "health") {
  const adminSecret = Deno.env.get("HEALTH_CHECK_SECRET");
  if (!adminSecret || req.headers.get("x-health-secret") !== adminSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const result = await checkProviderHealth();
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

### CR-02: `reconcile` action does not verify job ownership — any authenticated user can reset another user's job

**File:** `supabase/functions/generate-image/index.ts:1386-1411`
**Issue:** The `reconcile` path fetches the job by `dbJobId` but never checks `job.user_id !== user.id`. Any authenticated user who knows (or guesses) another user's UUID `jobId` can POST `{ action: "reconcile", jobId: "<victim-job-id>" }` to reset all failed tasks back to pending, causing re-generation charged to the victim's credit balance. The `work` action performs this check at line 659; the absence here is an inconsistency that is also an authorization bypass.
**Fix:**
```typescript
if (jobErr || !job) {
  return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, ... });
}
// Add immediately after:
if (job.user_id !== user.id) {
  return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, ... });
}
```

---

### CR-03: Non-atomic credit check + deduction creates multi-worker revenue-leak window

**File:** `supabase/functions/generate-image/index.ts:1029-1039, 1237-1243`
**Issue:** The credit balance is read at `attempt === 1` (line 1030) and deducted only on success (line 1237). With 3 parallel workers processing different tasks for the same job concurrently (the default is `PARALLEL_WORKERS = 3` on the client side), each worker independently reads the same credit balance before any deduction occurs. A user with 1 credit passes the check in all three workers, all generate images, and all attempt deduction. The `decrement_credits` RPC presumably prevents negative balance, but when it returns false the throw path requeues the task — meaning provider cost was incurred with no successful credit deduction. The check+deduct split provides a false sense of safety while the actual gate (the RPC) already handles it atomically.
**Fix:** Remove the pre-flight balance read entirely. Rely solely on the atomic `decrement_credits` RPC at deduction time. If the RPC returns false, map that to "Credits exhausted" and fail the task — this already happens at line 1242. The pre-flight check adds a TOCTOU race without preventing the underlying issue:
```typescript
// Delete lines 1029-1039 (the "Credit check only" block).
// The existing throw on deductErr/!deductResult is sufficient.
```

---

### CR-04: Home decor job insert error is silently swallowed — orphan tasks created against a non-existent job

**File:** `supabase/functions/generate-image/index.ts:1609-1614`
**Issue:** If `adminClient.from("generation_jobs").insert(...)` fails, the error is only `console.error`-ed. Execution continues to insert task rows against the non-existent `homeDecorJobId`, then returns a 200 success response. Subsequent `work` calls return 404. The client is left polling indefinitely for a job that was never persisted.
**Fix:**
```typescript
const { error: hdJobErr } = await adminClient!.from("generation_jobs").insert({ ... });
if (hdJobErr) {
  console.error("[HOME DECOR] Failed to create job:", hdJobErr);
  return new Response(JSON.stringify({ error: "Database error creating job" }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

### CR-05: `resolution` field bypasses schema validation via `as any` cast

**File:** `supabase/functions/generate-image/index.ts:238`
**Issue:** `const resolution = (parseResult.data as any).resolution || "1K"` — `resolution` is absent from `GenerateRequestSchema`, so any attacker-supplied string passes through unchecked. The value propagates into: `config.resolution` written to the DB, `resolution === "2K"` comparisons that control the credit multiplier (`hdCreditMultiplier`), model selection (`HD_ENGINE` vs `ENGINE`), and timeout logic. Sending `resolution: "2K"` could be used to force a higher-cost HD path on a standard-tier account.
**Fix:**
```typescript
// In GenerateRequestSchema:
resolution: z.enum(["0.5K", "1K", "2K", "4K"]).optional().default("1K"),
// Then use parseResult.data.resolution directly (no as any).
```

---

### CR-06: `base64url` spread of full `Uint8Array` will `RangeError` on large inputs

**File:** `supabase/functions/_shared/vertex-auth.ts:14`
**Issue:** `btoa(String.fromCharCode(...data))` spreads the entire array as function arguments. V8 throws `RangeError: Maximum call stack size exceeded` when argument count exceeds its internal limit (varies, typically ~65535 but lower in practice for `apply`). The RSA private key in PKCS8 DER encoding is ~1200–2400 bytes — borderline safe — but this is a latent crash that will trigger with longer key material or if the function is ever called with image bytes (as done unsafely in several `dataUrlToBytes` call sites throughout `generate-image/index.ts` at lines 39, 74, 314-315). `fal-adapter.ts` correctly chunks to 8192 bytes per iteration; `vertex-auth.ts` does not.
**Fix:**
```typescript
function base64url(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i += 8192) {
    binary += String.fromCharCode(...data.subarray(i, i + 8192));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
```

---

### CR-07: `updatePartialResults` only refreshes when task count grows — completed-task replacements are never shown

**File:** `src/pages/Generator.tsx:242-257`
**Issue:** `if (tasks && tasks.length > partialImagesRef.current.length)` — this condition is false whenever a failed task is replaced by a completed one (net count is unchanged). If a task fails on attempt 1 and succeeds on attempt 2, the new `result_url` is in the DB but the UI never re-renders it. Users see a stale "missing" placeholder for an image that has actually completed.
**Fix:**
```typescript
if (tasks) {
  const prevUrls = new Set(partialImagesRef.current.map(img => img.image).filter(Boolean));
  const hasNewResults = tasks.some(t => t.result_url && !prevUrls.has(t.result_url));
  if (tasks.length !== partialImagesRef.current.length || hasNewResults) {
    const sortedTasks = sortAndDedupTasks(tasks);
    // ... rest of update logic unchanged
  }
}
```

---

### CR-08: `resolveImageUrl` falls back to a bare storage path when signing is in-flight — broken `<img>` tags

**File:** `src/pages/Generator.tsx:91-95`
**Issue:** `return (p && signedMap[p]) || url;` — when `signedMap[p]` is undefined (signing query not yet complete), the original `url` is returned. For images stored as bare paths like `jobs/{id}/front/original.png`, this value is an unauthenticated storage path, not a URL. Rendering it in an `<img src>` will produce a 400/404/403 from Supabase Storage, resulting in broken images during the signing window. The UI has no way to distinguish "image not yet signed" from "image URL resolved."
**Fix:**
```typescript
const resolveImageUrl = useCallback((url: string | null): string | null => {
  if (!url) return null;
  const p = extractPathFromUrl(url);
  if (p) return signedMap[p] ?? null; // null = not yet signed; caller shows skeleton
  return url; // non-storage URL (external), safe to use directly
}, [signedMap]);
```
Update callers to handle `null` by rendering a skeleton/spinner instead of an `<img>` with a broken `src`.

---

## Warnings

### WR-01: `Retry-After` header parsed without NaN guard — `sleep(NaN)` fires immediately on 429

**File:** `supabase/functions/_shared/fal-adapter.ts:267-269`
**Issue:** `parseInt(retryAfterHeader, 10)` returns `NaN` when the header contains an HTTP-date string (e.g., `Fri, 09 May 2026 01:00:00 GMT`). `Math.min(NaN, 120_000)` is `NaN`. `setTimeout(fn, NaN)` fires immediately in V8/Deno, so the retry runs with no delay, almost certainly gets another 429, and exhausts all retries instantly.
**Fix:**
```typescript
const parsedSeconds = parseInt(retryAfterHeader, 10);
const retryAfterMs = Number.isFinite(parsedSeconds) && parsedSeconds > 0
  ? Math.min(parsedSeconds * 1000, 120_000)
  : retryDelays[attempt] ?? 60_000;
```

---

### WR-02: Silent image fetch failure continues generation with missing input — wrong output silently accepted

**File:** `supabase/functions/_shared/fal-adapter.ts:207-222`
**Issue:** If fetching an input image URL fails (network error or non-2xx), the `catch` at line 219 logs a warning and the loop continues. The `parts` array sent to Vertex AI is missing the input image. For an edit request (color variant generation) where the base view image is the primary input, Vertex may generate a plausible-looking but incorrect image that passes quality gates. The caller never knows the input was dropped.
**Fix:**
```typescript
} catch (e) {
  console.error(`[VERTEX] Failed to fetch image URL: ${url}`, e);
  return { ok: false, retryable: true, error: `Failed to fetch required input image` };
}
```

---

### WR-03: `authHeader.replace("Bearer ", "")` is not prefix-anchored — corrupts tokens with that substring

**File:** `supabase/functions/generate-image/index.ts:181`
**Issue:** `String.prototype.replace` with a string pattern replaces the first occurrence anywhere in the string. A JWT whose base64url payload happens to decode through the string (extremely unlikely but possible) would be silently corrupted. More practically: if the header is sent as `bearer token` (lowercase b), `replace` finds no match and passes the full `bearer <token>` string to `getUser`, which returns 401 without explanation.
**Fix:**
```typescript
const token = authHeader.startsWith("Bearer ")
  ? authHeader.slice(7).trim()
  : authHeader.trim();
```

---

### WR-04: Double `updateTaskResult` call on color-variant max-attempt path can overwrite `done` with `failed`

**File:** `supabase/functions/generate-image/index.ts:1109-1119`
**Issue:** When a color variant task hits `attempt >= effectiveMaxAttempts`, the code first sets `status = "failed"` via `.update().eq("status", "running")` (lines 1110-1115), then calls `updateTaskResult(task.id, null, lastError)` (line 1119) which runs another `.update().eq("id", taskId)` with no status guard. If a concurrent worker marked the task `done` between these two calls, the second `updateTaskResult` overwrites `done` with `failed`, causing a completed task to disappear from results.
**Fix:** Remove the direct `.update()` call and use only `updateTaskResult`. Add a status guard to `updateTaskResult` (see WR-05):
```typescript
if (attempt >= effectiveMaxAttempts) {
  await updateTaskResult(task.id, null, lastError);
} else {
  await moveTaskBackToPending(task.id, attempt, lastError);
}
```

---

### WR-05: `updateTaskResult` has no status guard — any call with `imageUrl=null` can overwrite `done` with `failed`

**File:** `supabase/functions/generate-image/index.ts:555-568`
**Issue:** The failure branch of `updateTaskResult` updates via `.eq("id", dbTaskId)` only. If called concurrently with (or after) a success that set `status = "done"`, it downgrades the task to `failed` with no image. This affects all error paths throughout the function.
**Fix:**
```typescript
} else {
  await adminClient
    .from("generation_tasks")
    .update({ status: "failed", last_error: error, updated_at: new Date().toISOString() })
    .eq("id", dbTaskId)
    .eq("status", "running"); // never downgrade a done task
}
```

---

### WR-06: `updateJobCounts` marks job `done` when `pending === 0 && done === 0 && failed === 0` (all tasks in `running`)

**File:** `supabase/functions/generate-image/index.ts:585-592`
**Issue:** Lines 588-592:
```typescript
} else if (pending === 0 && done < expectedTotal && failed === 0) {
  newStatus = "done";
}
```
The `pending` count (line 576) is computed via `.in("status", ["pending", "running"])`. Wait — re-reading: it filters `["pending", "running"]`, so `pending` here includes tasks currently running. If a single task transitions from `pending` to `running` between the three count queries and the others are zero, `pendingRes.count` could be 1 (the running task), which keeps the status as `running`. However, the variable is named `pending` but counts both `pending` and `running` tasks. If all tasks transition to `running` exactly between queries — `done=0, failed=0, pending=0` (all three count queries happen to miss the running tasks) — the condition evaluates true and the job is marked `done` prematurely.
**Fix:** Rename the variable to `pendingOrRunning` to make the semantic clear, and add a check that `done + failed >= tasksTotal` before marking done:
```typescript
const allAccountedFor = done + failed + pendingOrRunning >= expectedTotal;
if (done >= expectedTotal || (pendingOrRunning === 0 && allAccountedFor)) {
  newStatus = "done";
}
```

---

### WR-07: `finally` block can reset a successfully completed task back to `pending` at deadline

**File:** `supabase/functions/generate-image/index.ts:1286-1295`
**Issue:** The `finally` block checks `Date.now() > invocationDeadline - 250` and resets tasks still in `running` status to `pending`. If `updateTaskResult` (which sets status to `done`) is awaited but its network call is slow and the deadline fires, the task may still be `running` in the DB when the `finally` executes, causing a completed task to be requeued. The `.eq("status", "running")` guard on the `finally` update is the only protection — which fails if the `done` write hasn't landed yet.
**Fix:** `updateTaskResult` should throw on DB error so the failure is visible before the `finally` runs. Also add a local flag to skip the `finally` reset:
```typescript
let taskSucceeded = false;
try {
  // ... generation ...
  await updateTaskResult(task.id, persistedUrl, null); // throws on error
  taskSucceeded = true;
} finally {
  if (!taskSucceeded && Date.now() > invocationDeadline - 250) {
    await adminClient.from("generation_tasks").update({ status: "pending", ... }).eq("id", task.id).eq("status", "running");
  }
}
```

---

### WR-08: Service account JSON used without field presence validation

**File:** `supabase/functions/_shared/vertex-auth.ts:25, 29, 42`
**Issue:** After `JSON.parse(raw)`, `sa.client_email`, `sa.private_key`, and `sa.project_id` are used without existence checks. A valid JSON object missing `private_key` will throw inside `crypto.subtle.importKey` with a cryptic `TypeError: data: expected ArrayBuffer` rather than a clear configuration error. A missing `client_email` will send a JWT with `iss: undefined`.
**Fix:**
```typescript
const sa = JSON.parse(raw);
if (typeof sa.client_email !== "string" || typeof sa.private_key !== "string") {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing required fields: client_email, private_key");
}
```

---

### WR-09: `useSignedUrls` query key contains full path array — adding one path re-signs all paths

**File:** `src/integrations/supabase/hooks/useUserImages.ts:123-144`
**Issue:** `queryKey: ["signed-urls", paths]` uses the array directly. React Query deep-compares keys: adding one path (e.g., a new partial image arrives during polling) invalidates the cached entry for all previously signed paths, triggering a new `createSignedUrls` call for the entire batch. With the 1500ms polling tick in Generator.tsx, this causes continuous full-batch re-signing during active generation.
**Fix:** Use a stable sorted key string: `queryKey: ["signed-urls", [...paths].sort().join(",")]`. Or split into per-path queries so only new paths are signed.

---

### WR-10: Credit check skipped on retries (fashion) but performed every attempt (home decor) — inconsistent and leaky

**File:** `supabase/functions/generate-image/index.ts:1029, 747`
**Issue:** Fashion path: credit check only at `attempt === 1`. Home decor path: unconditional. If credits fall to 0 between attempt 1 and a subsequent attempt (another job deducts them), the fashion path proceeds with generation that will fail at deduction time and throw — requeuing indefinitely if the user never regains credits. This is an infinite retry loop. The home decor path avoids this by checking every time, but at the cost of one extra DB read per retry.
**Fix:** Apply the credit check on every attempt in both paths (consistent with home decor behavior), or adopt the reserve-on-claim pattern from CR-03.

---

### WR-11: `extractPathFromUrl` passes any non-HTTPS string through as a storage path without format validation

**File:** `src/integrations/supabase/hooks/useUserImages.ts:22-34`
**Issue:** Line 25: if `url` does not start with `https://` it is returned as-is. Any value in the `result_url` DB column that is not an HTTPS URL (e.g. a `data:` prefix, a relative path, or an injected string) is passed directly to `supabase.storage.createSignedUrls`. While RLS policies provide a second line of defense, this function is the only path-validation layer on the client side.
**Fix:**
```typescript
if (!url.startsWith("https://")) {
  // Validate it looks like a legitimate storage path
  if (/^[a-zA-Z0-9_\-\/\.]+$/.test(url) && url.length <= 512) return url;
  return null; // reject anything that doesn't look like a path
}
```

---

## Info

### IN-01: `signStoragePathOrUrl` is defined but has no visible call sites — likely dead code

**File:** `supabase/functions/generate-image/index.ts:428-450`
**Issue:** The function is defined with a JSDoc comment but does not appear to be called anywhere in this file. If no other modules reference it, it is dead code that adds maintenance surface alongside the three other signing helpers (`trySignExisting`, `uploadAndSign`, `uploadAndSignAtPath`).
**Fix:** Confirm with `grep -r "signStoragePathOrUrl"` across the project. If unused, remove it.

---

### IN-02: Temporary uploads at `{user.id}/tmp/` accumulate indefinitely

**File:** `supabase/functions/generate-image/index.ts:455-460`
**Issue:** `resolveToHttpUrl` uploads data URLs to `{user.id}/tmp/{uuid}.png` with a 1-hour signed URL but no cleanup of the underlying storage object. Every generation call that processes base64 inputs (the common case) permanently adds a file to `generated-images/{user.id}/tmp/`. Over time this grows without bound.
**Fix:** Schedule a delete after the generation completes, or use a storage lifecycle rule:
```typescript
// After generation loop completes:
await adminClient.storage.from(STORAGE_BUCKET).remove([tempPath]);
```

---

### IN-03: `workBatchSizeRef` critical constraint enforced only by comment

**File:** `src/pages/Generator.tsx:66`
**Issue:** `const workBatchSizeRef = useRef<number>(1); // CRITICAL: Must be 1 to prevent WORKER_LIMIT errors` — the "must be 1" constraint is documented only as a comment. The ref is mutable; future developers may change it without understanding the constraint.
**Fix:** Replace with an immutable constant:
```typescript
const WORK_BATCH_SIZE = 1; // Must remain 1 — changing causes WORKER_LIMIT errors in the Edge Function
```

---

### IN-04: `runWithConcurrency` allocates a `results` array that is partially used

**File:** `supabase/functions/generate-image/index.ts:1304-1323`
**Issue:** `const results: Array<PromiseSettledResult<void>> = new Array(items.length)` is created but only used in callers' `.some(r => r?.status === "rejected" && ...)` check. The array is sparse (indices are only written on catch), and the `some` check on a sparse array over unwritten entries (which are `undefined`) works coincidentally because `undefined?.status` is `undefined`, not `"rejected"`. This is fragile and non-obvious.
**Fix:** Return settled results from `Promise.allSettled` directly rather than manually maintaining a results array.

---

_Reviewed: 2026-05-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
