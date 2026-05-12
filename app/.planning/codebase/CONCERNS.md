# Concerns
<!-- last_mapped_commit: see git log -->
<!-- mapped: 2026-05-08 -->

## Security

### HIGH — Hardcoded Admin Email
- `snapshot@gmail.com` is hardcoded as an admin fallback in frontend components, DB migrations, and `admin_rpc.sql`
- Bypasses the proper `is_admin()` RPC function
- Any compromise or reassignment of this email grants admin access
- **Files:** `src/components/RequireAdmin.tsx`, `admin_rpc.sql`, migrations
- **Fix:** Remove hardcoded email; rely exclusively on `is_admin()` RPC + DB flag

### HIGH — CORS Wildcard on Admin Edge Functions
- All Edge Functions including admin-scoped ones return `Access-Control-Allow-Origin: *`
- Admin endpoints should restrict origins to the production domain
- **File:** `supabase/functions/generate-image/index.ts` and other functions
- **Fix:** Set CORS origin to `SITE_URL` env var for admin routes

### MEDIUM — Duplicated OAuth2 Token Cache
- Vertex AI OAuth token is cached in module-level globals in both `fal-adapter.ts` and `vertex-auth.ts`
- Token refresh race conditions possible under concurrent edge function invocations
- **Files:** `supabase/functions/_shared/fal-adapter.ts`, `supabase/functions/_shared/vertex-auth.ts`
- **Fix:** Consolidate to single auth module; use Supabase KV or DB for token state if needed

## Tech Debt

### CRITICAL — God Function: `generate-image/index.ts`
- 1535-line edge function handling: auth, job creation, task claiming, AI calling, storage, rate-limiting, and stale recovery
- All logic in a single `switch(action)` block
- Extremely difficult to test, debug, or modify safely
- **File:** `supabase/functions/generate-image/index.ts`

### HIGH — God Component: `Admin.tsx`
- 2513-line component containing the entire admin dashboard
- All tabs, tables, and actions in one file
- **File:** `src/pages/Admin.tsx`

### HIGH — Duplicated Vertex AI OAuth Implementation
- Two separate implementations of Vertex AI OAuth token fetching/caching
- Will diverge over time
- **Files:** `supabase/functions/_shared/fal-adapter.ts`, `supabase/functions/_shared/vertex-auth.ts`

### MEDIUM — Orphaned `fal-vision-adapter.ts`
- Requires `FAL_KEY` environment variable
- Not imported by any active function
- Dead code that could confuse onboarding
- **File:** `supabase/functions/_shared/fal-vision-adapter.ts`

### MEDIUM — Duplicate Tailwind Config
- `tailwind.config copy.ts` exists at project root alongside `tailwind.config.ts`
- **File:** `tailwind.config copy.ts`
- **Fix:** Delete it

### MEDIUM — Orphaned `Index.tsx`
- Duplicate generation page alongside `Generator.tsx`
- Not referenced in `App.tsx` routing
- **File:** `src/pages/Index.tsx`
- **Fix:** Delete or reconcile with `Generator.tsx`

### LOW — `as any` Cast in `useCredits.ts`
- `supabase as any` cast to read `resolution` field from a Zod-validated schema
- Indicates type alignment issue between DB types and runtime data
- **File:** `src/integrations/supabase/hooks/useCredits.ts`

### LOW — Admin Pagination is Client-Side Only
- Admin tables load up to 250 users and 200 jobs at once
- No server-side pagination implemented
- Will degrade as data grows
- **File:** `src/pages/Admin.tsx`

## Known Bugs

### CRITICAL — Silent Credit Deduction Failure (Revenue Leak)
- Credit deduction after successful image upload is swallowed silently
- Users can receive generated images without credits being consumed
- No alerting or monitoring
- **File:** `supabase/functions/generate-image/index.ts`

### HIGH — Stale Task Recovery Resets `attempt_count` to 0
- Stale task recovery branch resets attempt counter, enabling infinite retries
- Race condition possible under concurrent workers
- Multiple regressions in git history on this code path
- **File:** `supabase/functions/generate-image/index.ts`

### MEDIUM — Signed URLs Stored as Permanent `result_url`
- Supabase Storage signed URLs expire after 24 hours
- Stored as permanent `result_url` values in DB
- Images become inaccessible after 24h for affected records
- **Fix:** Store storage path, generate signed URLs on-demand at display time

## Performance

### MEDIUM — WASM ImageScript Cold-Start
- WASM ImageScript module loaded on every edge function invocation
- Contributes to cold-start latency
- Consider pre-warming or lazy-loading only when needed

### MEDIUM — Per-Task DB Query Fetching All Variant Colors
- Each generation task fetches variant colors from DB individually
- Should be pre-stored in job config JSON at job creation time

### MEDIUM — `useUserImages` Unconditional 500-Row Fetch
- Fetches up to 500 images on every mount with no pagination
- Will become slow as user image counts grow
- **File:** `src/integrations/supabase/hooks/useUserImages.ts`

## Fragile Areas

### CRITICAL — Task State Machine Stale Recovery
- The stale task recovery and retry branches in the generation job queue have regressed multiple times (per git history)
- Core to the HD generation flow
- Any modifications here require careful testing

### HIGH — HD Job Early Return + Client Retry
- HD generation relies on anchor image completing first, then client retrying for HD
- Flow is sensitive to timing; client retry reliability is unclear

### HIGH — Stripe Credit Map Silent Fallback
- Stripe webhook maps price IDs to credit amounts
- Unknown price IDs silently map to 0 credits
- Customer pays but receives no credits
- **Fix:** Throw or alert on unknown price IDs

## Zero Test Coverage

No automated tests exist. All bugs above were identified by static analysis. Regressions are caught only by manual testing or user reports.
