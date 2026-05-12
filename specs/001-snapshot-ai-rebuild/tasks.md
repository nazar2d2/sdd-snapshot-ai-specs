# Tasks: snap-shot.ai Phase 3 — Stability, Security & Rebuild

**Input**: Design documents from `specs/001-snapshot-ai-rebuild/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story. Each story is independently testable.
Each task references the exact file to be changed.

**Application root (`app/`)**: Every task line below uses **repo-relative paths** starting with `app/` (the Vite + Supabase application). Run `npm`, `npm run build`, `npm run lint`, and Supabase CLI commands from **`app/`** (`cd app`). Imports inside source files still use `@/` or relative paths without the `app/` prefix.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on same file)
- **[Story]**: Which user story this task belongs to (US1–US13; see `spec.md`)

---

## Phase 1: Setup (Clean Workspace)

**Purpose**: Remove dead code and stale files before touching any live logic.
These are the fastest wins and eliminate confusion during subsequent phases.

- [ ] T001 [US7] Delete orphaned `app/src/pages/Index.tsx` (not referenced in App.tsx routing)
- [ ] T002 [US7] Delete orphaned `app/supabase/functions/_shared/fal-vision-adapter.ts` (unused, requires FAL_KEY)
- [ ] T003 [US7] Delete stale `app/tailwind.config copy.ts` (duplicate Tailwind config next to `app/package.json`)
- [ ] T004 [US7] From `app/`, verify `npm run build` succeeds after deletions (confirms no hidden imports)

**Checkpoint**: Build passes; three orphaned files are gone.

---

## Phase 2: Foundational (Shared Infrastructure)

**Purpose**: Create shared utilities that multiple user stories depend on.

- [ ] T005 [P] Create `app/supabase/functions/_shared/cors.ts` — `buildCorsHeaders()` that reads `SITE_URL` env var; falls back to `"null"` with warning if unset
- [ ] T006 [P] Create `app/supabase/migrations/20260512_admin_pagination_rpcs.sql` — add `p_limit INT DEFAULT 50` and `p_offset INT DEFAULT 0` to `admin_get_users` and `admin_get_jobs` RPCs; include `total_count` in response JSON

**Checkpoint**: Shared CORS helper available; pagination RPCs written and ready to migrate.

---

## Phase 3: User Story 2 — Admin Access via DB Role Only (Priority: P1) 🎯

**Goal**: Remove every hardcoded `snapshot@gmail.com` reference. Admin access gates
exclusively on `profiles.is_admin` DB flag via `is_admin()` RPC.

**Independent Test**: Set `is_admin = false` for the hardcoded email account → navigate to
`/admin` → confirm redirect. Then set `is_admin = true` → confirm access granted.

### Implementation for User Story 2

- [ ] T007 [US2] Remove every hardcoded `snapshot@gmail.com` fallback from `app/src/components/RequireAdmin.tsx` — delete the `isEmailAdmin` variable, the RPC-error branch that sets admin true when the email matches, the `!isAdmin && !isEmailAdmin` coupling (admin must come from RPC only), and the `catch` block that grants access by email. Keep only a successful `is_admin()` RPC result as proof of admin access.
- [ ] T008 [US2] Search and remove `snapshot@gmail.com` from `app/admin_rpc.sql` — replace any `WHERE email = 'snapshot@gmail.com'` logic with `WHERE is_admin = true`
- [ ] T009 [US2] Audit all `app/supabase/migrations/*.sql` files for hardcoded email references; add a corrective migration `app/supabase/migrations/20260512_remove_hardcoded_admin.sql` if any migration seeds by email instead of by UUID+flag

**Checkpoint**: From the repo root, `rg "snapshot@gmail.com" app/src app/supabase app/admin_rpc.sql` returns zero results (or run the same search from `app/` against `src`, `supabase`, and `admin_rpc.sql`).

---

## Phase 4: User Story 3 — Admin CORS Restricted to SITE_URL (Priority: P1) 🎯

**Goal**: All admin-scoped edge functions return CORS headers limited to `SITE_URL`.

**Independent Test**: OPTIONS preflight to `/functions/v1/admin-create-user` from a
non-production origin returns `Access-Control-Allow-Origin: https://snap-shot.ai`, not `*`.

### Implementation for User Story 3

- [ ] T010 [US3] Update `app/supabase/functions/admin-create-user/index.ts` — replace inline CORS headers object with `buildCorsHeaders()` from `../_shared/cors.ts` (depends on T005)
- [ ] T011 [US3] Update `app/supabase/functions/admin-delete-user/index.ts` — same CORS replacement (depends on T005)
- [ ] T012 [US3] Update `app/supabase/functions/admin-purchases/index.ts` — same CORS replacement (depends on T005)
- [ ] T013 [US3] Update `app/supabase/functions/admin-whitelist/index.ts` — same CORS replacement (depends on T005)

**Checkpoint**: All four admin functions use `buildCorsHeaders()`. No `"*"` CORS string remains
in any admin function file.

---

## Phase 5: User Story 1 — HD Generation Pending State (Priority: P1) 🎯

**Goal**: When the anchor image task is not yet complete, `work` action returns a structured
`anchor_pending` response; the client shows a human-readable retry state.

**Independent Test**: Trigger HD generation while anchor is still pending → UI shows
"Anchor image is still generating" message within 2 seconds; no frozen spinner after 10s.

### Implementation for User Story 1

- [ ] T014 [US1] In `app/supabase/functions/generate-image/index.ts`: locate the HD generation branch in the `work` action handler; add a check — if the `anchor` variant task for the same job is not `completed`, return `{ status: "anchor_pending", retryAfterMs: 3000, message: "Anchor image is still generating. Retry after the specified delay." }`
- [ ] T015 [US1] In `app/src/pages/Generator.tsx`: update the polling/retry logic that handles the `work` action response — when `status === "anchor_pending"`, show a `<LoadingState>` message "Generating your anchor image first…" and schedule a retry after `retryAfterMs` ms using the existing retry mechanism in `app/src/lib/invokeEdgeFunctionWithRetry.ts`
- [ ] T016 [US1] In `app/src/components/LoadingState.tsx`: add an optional `message` prop that renders below the spinner so the anchor-pending message can be displayed without modifying the spinner itself

**Checkpoint**: HD generation shows "Generating your anchor image first…" when anchor not ready.
No frozen spinner. Retry recovers automatically.

---

## Phase 6: User Story 4 — WASM Lazy Load (Priority: P2)

**Goal**: WASM ImageScript module loads only when image encoding is actually needed.

**Independent Test**: Add a temporary `console.log("[WASM] loading")` before the WASM import;
invoke `create_job` → check Supabase logs; confirm `[WASM] loading` does NOT appear.

### Implementation for User Story 4

- [ ] T017 [US4] In `app/supabase/functions/generate-image/index.ts`: find the top-level `import ImageScript from "imagescript/index.js"` (or equivalent); move it inside the specific code branch that performs image encoding using `const { default: ImageScript } = await import("imagescript/index.js")`. Remove the top-level static import.

**Checkpoint**: Supabase Edge Function logs show no WASM load on `create_job` invocations.

---

## Phase 7: User Story 5 — Named Handler Extraction (Priority: P2)

**Goal**: The three critical code paths in `generate-image/index.ts` are named async functions.
The top-level `switch` block delegates to them; it contains no inline business logic.

**Independent Test**: Read `generate-image/index.ts` → switch block has `case "create_job": return handleCreateJob(req, user, supabaseClient)` style delegation → named functions exist with JSDoc.

### Implementation for User Story 5

- [ ] T018 [US5] In `app/supabase/functions/generate-image/index.ts`: extract the `create_job` action logic into `async function handleCreateJob(req: Request, user: User, supabase: SupabaseClient): Promise<Response>` with a JSDoc comment describing its contract. Wire `case "create_job":` to call it.
- [ ] T019 [US5] In `app/supabase/functions/generate-image/index.ts`: extract the `work` action logic (now including the anchor-pending check from T014) into `async function handleWork(req: Request, user: User, supabase: SupabaseClient): Promise<Response>` with JSDoc. Wire `case "work":` to call it.
- [ ] T020 [US5] In `app/supabase/functions/generate-image/index.ts`: extract the `get_results` action logic into `async function handleGetResults(req: Request, user: User, supabase: SupabaseClient): Promise<Response>` with JSDoc. Wire `case "get_results":` to call it.
- [ ] T021 [US5] Verify the refactored `generate-image` edge function passes a full generation flow end-to-end: create_job → multiple work invocations → get_results → images appear in gallery. No functional regression.

**Checkpoint**: Switch block is a routing table of named function calls. Three handler functions
exist with JSDoc. End-to-end generation flow passes.

---

## Phase 8: User Story 6 — Admin Dashboard Split (Priority: P2)

**Goal**: `Admin.tsx` shrinks to < 150 lines; each tab lives in its own component file.

**Independent Test**: Open each admin tab in browser → all data loads correctly → open
`app/src/pages/Admin.tsx` → under 150 lines → open `app/src/components/admin/` → five tab files present.

### Implementation for User Story 6

- [ ] T022 [P] [US6] Create `app/src/components/admin/UsersTab.tsx` — extract all Users tab JSX, data-fetching calls, and handler functions from `app/src/pages/Admin.tsx`
- [ ] T023 [P] [US6] Create `app/src/components/admin/JobsTab.tsx` — extract all Jobs tab JSX and handlers from `app/src/pages/Admin.tsx`; wire the paginated `admin_get_jobs` RPC call (depends on T006)
- [ ] T024 [P] [US6] Create `app/src/components/admin/AnalyticsTab.tsx` — extract Analytics tab from `app/src/pages/Admin.tsx`
- [ ] T025 [P] [US6] Create `app/src/components/admin/WhitelistTab.tsx` — extract Whitelist tab from `app/src/pages/Admin.tsx`
- [ ] T026 [P] [US6] Create `app/src/components/admin/PurchasesTab.tsx` — extract Purchases tab from `app/src/pages/Admin.tsx`
- [ ] T027 [US6] Refactor `app/src/pages/Admin.tsx` to import and render the five tab components; reduce file to the tab-switching router shell (< 150 lines); ensure all state previously local to Admin.tsx is moved to the appropriate sub-component (depends on T022–T026)
- [ ] T028 [US6] Wire `UsersTab.tsx` and `JobsTab.tsx` to use the paginated `admin_get_users` and `admin_get_jobs` RPCs with page-number state and a pagination control component (depends on T006, T022, T023)

**Checkpoint**: Admin.tsx < 150 lines. All five tabs load data. Pagination controls visible
on Users and Jobs tabs.

---

## Phase 9: User Story 8 — Stripe Unknown Price ID Observable Error (Priority: P3)

**Goal**: Unknown price IDs cause an observable error, not a silent 0-credit application.

**Independent Test**: Send a Stripe test webhook with an unknown `price_id` → Supabase logs
show an error entry → credits are NOT applied.

### Implementation for User Story 8

- [ ] T029 [US8] In `app/supabase/functions/stripe-webhook/index.ts`: locate the price-ID-to-credits lookup (the hardcoded map or metadata lookup); replace the current `|| 0` fallback with `throw new Error(\`Unknown Stripe price ID: \${priceId} — credits NOT applied. Update the price map.\`)`

**Checkpoint**: Supabase function logs show the error on unknown price ID. No 0-credit silent
application occurs.

---

## Phase 10: User Story 9 — useUserImages Pagination (Priority: P3)

**Goal**: `useUserImages` hook supports pagination; does not unconditionally load 500 rows.

**Independent Test**: Open `/my-images` → check Network tab → Supabase query uses `.range(0, 49)`
or equivalent rather than `.limit(500)`.

### Implementation for User Story 9

- [ ] T030 [US9] In `app/src/integrations/supabase/hooks/useUserImages.ts`: replace the unconditional 500-row fetch with a paginated approach — add `page` and `pageSize` (default 50) parameters; use Supabase `.range(offset, offset + pageSize - 1)` query; expose `totalCount`, `hasNextPage`, and a `loadNextPage` function
- [ ] T031 [US9] In `app/src/pages/MyImages.tsx`: wire the updated `useUserImages` hook — add "Load more" button (or infinite scroll) that calls `loadNextPage`; show a total count indicator

**Checkpoint**: My Images page loads 50 rows on mount. "Load more" fetches next 50. Network
tab confirms range-based queries.

---

## Phase 11: Billing & Access Integrity (Priority: P1 / P2)

**Purpose**: Fix the four billing and access-control gaps that can hurt paying customers
regardless of Phase 3 stability work. All changes are purely additive — they do not touch
the core generation flow.

**Independent Test**: Each task below has an isolated test that does not require generation to run.

### User Story 10 — Subscription Cancellation Revokes Tier

- [ ] T038 [US10] In `app/supabase/functions/stripe-webhook/index.ts`: locate `handleSubscriptionDeleted` (around line 201); add `subscription_tier: "none"` to the `.update({ ... })` object alongside the existing `subscription_status: "canceled"`. Confirm one-time top-up credit balance is NOT cleared (only tier is set to none).

**Checkpoint**: Cancel a test Stripe subscription → query `profiles` → `subscription_tier = "none"` and credits are preserved.

---

### User Story 11 — Webhook Idempotency

- [ ] T039 [US11] Create migration `app/supabase/migrations/20260512_stripe_processed_events.sql` — add table `stripe_processed_events (event_id TEXT PRIMARY KEY, processed_at TIMESTAMPTZ DEFAULT now())` with an RLS policy allowing only service-role inserts
- [ ] T040 [US11] In `app/supabase/functions/stripe-webhook/index.ts`: at the top of the handler (after signature verification), check if `event.id` exists in `stripe_processed_events` via `adminClient`; if found, return HTTP 200 immediately (skip processing); if not found, proceed and insert the event ID into `stripe_processed_events` before returning (depends on T039)

**Checkpoint**: Send the same test webhook event ID twice → credits applied exactly once → `stripe_processed_events` has one row for that event ID.

---

### User Story 12 — Checkout Price ID Allowlist

- [ ] T041 [US12] In `app/supabase/functions/create-checkout/index.ts`: add a `const ALLOWED_PRICE_IDS = new Set([...])` constant at the top of the file containing all known subscription and top-up price IDs (8 subscription + 4 top-up = 12 total, sourced from `app/src/components/homepage/HomepagePricing.tsx` and `app/src/components/CreditTopUpModal.tsx`); add an early-return check `if (!ALLOWED_PRICE_IDS.has(priceId)) return 400 response` before the Stripe session creation logic

**Checkpoint**: Call `create-checkout` with `priceId: "price_FAKE"` → HTTP 400 → no Stripe session created.

---

### User Story 13 — Zero-Credit Gate and useCredits Fix

- [ ] T042 [US13] In `app/src/integrations/supabase/hooks/useCredits.ts`: add `is_unlimited` to the `.select(...)` query alongside existing fields (the DB column is `is_unlimited`, NOT `unlimited` — see `app/supabase/migrations/20260120200000_add_unlimited_flag.sql`); add `is_unlimited: boolean | null` to the `ProfileData` interface and the fallback return objects; expose it from the hook as `isUnlimited` so components can read it
- [ ] T043 [US13] In `app/src/pages/Generator.tsx`: add `import { useCredits } from "@/integrations/supabase/hooks/useCredits"` and `import { CreditTopUpModal } from "@/components/CreditTopUpModal"` at the top (neither is currently imported); call `const { credits, isUnlimited, isLoading } = useCredits()` near the top of the component; if `!isLoading && credits === 0 && !isUnlimited` render an inline banner "You've used all your credits. Top up to generate more." with a "Top up" button that opens `<CreditTopUpModal>` — the generation form remains hidden until credits are available (depends on T042)

**Checkpoint**: Set `profiles.credits = 0`, `is_unlimited = false`, `subscription_tier = "paid"` → open `/app` → see the top-up prompt, not the generator form.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, documentation, and final verification after all stories are complete.

- [ ] T032 [P] From `app/`, run `npm run lint` and fix any ESLint errors introduced by the refactoring
- [ ] T033 [P] From `app/`, run `npm run build` and confirm zero TypeScript errors in the final build
- [ ] T034 Run through the full Quickstart checklist in `specs/001-snapshot-ai-rebuild/quickstart.md` — verify all 13 user stories pass their acceptance tests
- [ ] T035 From the repo root, run `rg "snapshot@gmail.com" app/src app/supabase app/admin_rpc.sql` — confirm zero matches (or `grep -R "snapshot@gmail.com" app/src app/supabase app/admin_rpc.sql` if `rg` is not installed)
- [ ] T036 From the repo root, run `rg "Access-Control-Allow-Origin.*\*" app/supabase/functions/admin-*` — confirm zero matches in admin function sources (or `grep -R "Access-Control-Allow-Origin" app/supabase/functions/admin-* | grep '\*'` as an equivalent check)
- [ ] T037 [P] Update `app/README.md` to remove the Lovable template boilerplate and replace with a real project description for snap-shot.ai (repo root `README.md` is the monorepo overview)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; clears dead code
- **Phase 2 (Foundational)**: Depends on Phase 1 complete; creates shared utilities used by Phase 3–5
- **Phase 3 (US2 Admin Email)**: Depends on Phase 2; can start after T006 is committed
- **Phase 4 (US3 Admin CORS)**: Depends on T005 (cors.ts); T010–T013 can run in parallel after T005
- **Phase 5 (US1 HD Retry)**: Depends on Phase 1 completion; independent of CORS work
- **Phase 6 (US4 WASM)**: Depends on Phase 1; independent of all other phases
- **Phase 7 (US5 Named Handlers)**: Depends on T014 (Phase 5) being complete; extractions must happen after anchor-pending logic is inserted
- **Phase 8 (US6 Admin Split)**: Depends on T006 (pagination RPCs); tab files can be created in parallel (T022–T026)
- **Phase 9 (US8 Stripe error)**: No dependencies; can run in parallel with Phase 8
- **Phase 10 (US9 useUserImages)**: No dependencies; can run in parallel with Phase 8–9
- **Phase 11 (Billing integrity)**: T038 has no dependencies; T039 has no dependencies; T040 depends on T039; T041 has no dependencies; T042 has no dependencies; T043 depends on T042
- **Phase 12 (Polish)**: Depends on all previous phases

### User Story Dependencies (Summary)

| Story | Priority | Depends On | Can Run In Parallel With |
|-------|----------|------------|--------------------------|
| US2 (Admin Email) | P1 | T005 | US3 (after T005) |
| US3 (Admin CORS) | P1 | T005 | US2 (after T005) |
| US1 (HD Retry) | P1 | Phase 1 done | US2, US3 |
| US7 (Dead Code) | P2 | — | All stories (done in Phase 1) |
| US4 (WASM) | P2 | Phase 1 done | US2, US3, US1 |
| US5 (Named Handlers) | P2 | US1 (T014) | US4, US6 |
| US6 (Admin Split) | P2 | T006 | US5, US8, US9 |
| US8 (Stripe error) | P3 | — | US6, US9 |
| US9 (Pagination) | P3 | — | US6, US8 |
| US10 (Cancel revokes tier) | P1 | — | All others (stripe-webhook only) |
| US11 (Webhook idempotency) | P1 | T039 | US10, US12 |
| US12 (Price ID allowlist) | P1 | — | US10, US11 |
| US13 (Zero-credit gate) | P2 | T042 | US9, US10 |

### Parallel Opportunities

- T005 and T006 can run simultaneously (different files)
- T010, T011, T012, T013 can all run in parallel (different function files, same dependency T005)
- T022, T023, T024, T025, T026 can run in parallel (different component files)
- T029, T030 can run in parallel (stripe-webhook vs useUserImages — no shared files)
- T038, T039, T041, T042 can all run in parallel (different files, no shared dependencies)
- T040 depends on T039; T043 depends on T042

---

## Parallel Example: Phase 4 (Admin CORS)

```bash
# All four admin CORS updates can run simultaneously after T005:
Task: "T010 Update admin-create-user/index.ts"
Task: "T011 Update admin-delete-user/index.ts"
Task: "T012 Update admin-purchases/index.ts"
Task: "T013 Update admin-whitelist/index.ts"
```

## Parallel Example: Phase 8 (Admin Split)

```bash
# All five tab extractions can run simultaneously:
Task: "T022 Create UsersTab.tsx"
Task: "T023 Create JobsTab.tsx"
Task: "T024 Create AnalyticsTab.tsx"
Task: "T025 Create WhitelistTab.tsx"
Task: "T026 Create PurchasesTab.tsx"
```

---

## Implementation Strategy

### MVP First (All P1 Stories — US1, US2, US3, US10, US11, US12)

1. Complete Phase 1: Delete dead code (T001–T004) — 15 min
2. Complete Phase 2: Create cors.ts and pagination migration (T005–T006) — 30 min
3. Complete Phase 3: Remove hardcoded admin email (T007–T009) — 20 min
4. Complete Phase 4: Admin CORS restriction (T010–T013 in parallel) — 20 min
5. Complete Phase 5: HD pending state (T014–T016) — 45 min
6. Complete Phase 11 P1 billing fixes (T038–T041 in parallel) — 30 min
7. **STOP and VALIDATE**: Run quickstart steps for US1, US2, US3, US10, US11, US12

### Full Delivery (All Stories)

Continue from MVP:

8. Phase 6: WASM lazy load (T017) — 30 min
9. Phase 7: Named handler extraction (T018–T021) — 60 min
10. Phase 8: Admin decomposition (T022–T028 in parallel) — 90 min
11. Phase 9: Stripe error on unknown price (T029) — 15 min
12. Phase 10: useUserImages pagination (T030–T031) — 45 min
13. Phase 11 P2: Zero-credit gate (T042–T043) — 30 min
14. Phase 12: Polish (T032–T037) — 30 min

---

## Notes

- [P] tasks = different files, no shared dependencies — safe to run in parallel
- [Story] label maps to user stories US1–US13 in `spec.md` for traceability
- T014 and T019 both modify `app/supabase/functions/generate-image/index.ts` — they MUST be sequential (T014 first)
- All `app/supabase/functions/generate-image/index.ts` changes in Phases 5 and 7 MUST be end-to-end tested (T021)
  before deployment — this is the revenue-critical path
- Admin tab split (T022–T026) should be reviewed per-tab before T027 assembles them
- After T006 and T009, run `supabase db push` or `npm run db:push` from **`app/`** to apply the new migrations
