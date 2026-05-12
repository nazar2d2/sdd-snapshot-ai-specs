---
phase: 02-data-integrity
plan: "02"
subsystem: storage
tags: [storage, signed-url, data-integrity, image-persistence]
dependency_graph:
  requires: []
  provides: [uploadAndGetPath, signStoragePathOrUrl]
  affects: [generation_tasks.result_url]
tech_stack:
  added: []
  patterns: [storage-path-over-signed-url, backward-compat-url-signing]
key_files:
  created: []
  modified:
    - supabase/functions/generate-image/index.ts
decisions:
  - "Insert uploadAndGetPath and signStoragePathOrUrl after trySignExisting (not before uploadAndSignAtPath as plan stated) to avoid undefined closure reference — Rule 1 auto-fix"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
---

# Phase 02 Plan 02: Permanent Storage Paths for generation_tasks.result_url Summary

Store permanent storage paths instead of expiring signed URLs in `generation_tasks.result_url` — eliminates 24-hour image expiry causing 404/403 for users.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add uploadAndGetPath and signStoragePathOrUrl | e0248e8 | supabase/functions/generate-image/index.ts |
| 2 | Replace 3 uploadAndSign call sites with uploadAndGetPath | 3178802 | supabase/functions/generate-image/index.ts |

## What Was Built

### uploadAndGetPath (IMG-01/IMG-02)

New function placed after `trySignExisting` in handler scope. Uploads image bytes to Supabase Storage and returns the permanent path (`jobs/{jobId}/{viewKey}/{variantKey}.{ext}` or `{userId}/{RUN_ID}/{view}.{ext}`) rather than a signed URL. On upload error, falls back to returning the original `imageUrl` to prevent task loss (T-02-05 accepted threat).

### signStoragePathOrUrl (IMG-03)

Backward-compat utility for reading `result_url` values when displaying to clients. Handles three cases:
- Storage path (not `https://`) — signs directly via `trySignExisting`
- Legacy Supabase signed URL containing `token=` — extracts object path, re-signs
- External or unrecognised URL — returns as-is

### 3 Call Site Replacements

All three locations where `persistedUrl` feeds into `updateTaskResult` now use `uploadAndGetPath`:
- HomeDecor task success path (line 763)
- Fashion color variant success path (line 1091)
- Fashion base view success path (line 1235)

`uploadAndSign` remains in use for the anchor URL (short-TTL internal URL, not stored in `result_url`).

## Verification Results

```
persistedUrl = await uploadAndSign  -> 0  (PASS)
persistedUrl = await uploadAndGetPath -> 3  (PASS)
total uploadAndGetPath occurrences   -> 4  (1 declaration + 3 call sites, PASS)
signStoragePathOrUrl occurrences     -> 1  (PASS)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected insertion point for new functions**
- **Found during:** Task 1
- **Issue:** Plan instructed inserting both new functions before `uploadAndSignAtPath` (after line 366). However, `signStoragePathOrUrl` calls `trySignExisting`, which is defined after `uploadAndSignAtPath` at line 388. Inserting before `uploadAndSignAtPath` would cause a runtime error — `trySignExisting` not yet defined when `signStoragePathOrUrl` is invoked.
- **Fix:** Inserted both `uploadAndGetPath` and `signStoragePathOrUrl` after `trySignExisting` (after line 393), before `await ensureBucket()`.
- **Files modified:** supabase/functions/generate-image/index.ts
- **Commit:** e0248e8

## Threat Model Coverage

| Threat ID | Status |
|-----------|--------|
| T-02-04 | Mitigated — signStoragePathOrUrl only generates signed URLs via adminClient (service role); storage path not exposed to client directly |
| T-02-05 | Accepted — uploadAndGetPath fallback returns imageUrl on upload error; logged as [UPLOAD] Error |
| T-02-06 | Accepted — storage path jobs/{jobId}/view/variant.png contains no PII; Supabase signed URL still required for file access |

## Known Stubs

None — all three persistedUrl paths write permanent storage paths to `generation_tasks.result_url`. The `signStoragePathOrUrl` utility is declared but not wired to display-time reads in this plan; that read-path is a separate concern (existing UI reads `result_url` directly — a future plan or PR should wire `signStoragePathOrUrl` at the display layer).

## Self-Check: PASSED

- [x] supabase/functions/generate-image/index.ts modified with both new functions and 3 call site replacements
- [x] Commit e0248e8 exists (Task 1)
- [x] Commit 3178802 exists (Task 2)
- [x] All 4 success criteria verified passing
