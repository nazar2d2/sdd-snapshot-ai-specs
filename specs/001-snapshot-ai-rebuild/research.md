# Research: snap-shot.ai Phase 3

**Feature**: 001-snapshot-ai-rebuild
**Date**: 2026-05-12

## Decision Log

### D-001: HD Generation Anchor-Not-Ready Response

- **Decision**: Return structured `{ status: "anchor_pending", retryAfterMs: 3000 }` from the
  `work` action when the anchor image task is not yet complete.
- **Rationale**: The client's `invokeEdgeFunctionWithRetry.ts` already handles retries. A
  semantic status field allows the UI to distinguish "anchor not ready" (expected transient
  state) from a real error without additional polling infrastructure.
- **Alternatives considered**:
  - Blocking in-function until anchor completes: rejected — Deno 60s timeout; blocks worker slot.
  - New polling RPC endpoint: rejected — adds complexity for the same end result.

### D-002: CORS Origin Restriction via SITE_URL

- **Decision**: Create `supabase/functions/_shared/cors.ts` that reads `Deno.env.get("SITE_URL")`
  and returns `"null"` (deny-all) if not set, with a warning log.
- **Rationale**: `SITE_URL` is already configured in Supabase project secrets. Centralising
  the CORS helper means the fix applies to all admin functions by importing one module.
- **Alternatives considered**:
  - Hardcode `https://snap-shot.ai`: rejected — breaks staging/dev environments.
  - Environment-aware list: over-engineering for a single domain product.

### D-003: Admin Email Removal Strategy

- **Decision**: Remove the `snapshot@gmail.com` literal from `RequireAdmin.tsx`, `admin_rpc.sql`,
  and any migration that references it. The `is_admin()` RPC is the sole gate.
- **Rationale**: The RPC already exists and works. The hardcoded check is purely a legacy
  fallback that predates the RPC implementation.
- **Alternatives considered**:
  - Environment variable for admin email: rejected — still a single-point-of-failure bypass;
    the RPC + DB flag is the correct model.

### D-004: WASM Lazy Load via Dynamic Import

- **Decision**: Move the ImageScript import inside the handler branch that requires image
  encoding using `const { default: ImageScript } = await import("imagescript/index.js")`.
- **Rationale**: Deno supports top-level dynamic `await import()`. The WASM bundle is ~500KB;
  lazy-loading removes it from the cold-start path for `create_job`, `get_results`, and
  other non-encoding actions.
- **Risk**: Dynamic import caching behaviour in Deno Edge — the module should be cached after
  first load within a warm instance. This is acceptable.

### D-005: Named Handler Extraction Scope

- **Decision**: Extract only the three fragile paths for Phase 3: `handleCreateJob`,
  `handleWork`, `handleGetResults`. Full module split (separate files per action) is deferred.
- **Rationale**: Minimises diff size and regression risk. The goal is readability and
  testability of critical paths, not architectural purity.

### D-006: Admin Component Split Granularity

- **Decision**: One file per admin tab in `src/components/admin/`: `UsersTab.tsx`,
  `JobsTab.tsx`, `AnalyticsTab.tsx`, `WhitelistTab.tsx`, `PurchasesTab.tsx`. `Admin.tsx`
  becomes a thin tab-router.
- **Rationale**: Each tab is independently scrollable and has its own data-fetching logic.
  Splitting at tab level is the natural boundary.
- **Alternatives considered**:
  - Further split into sub-components per tab section: deferred; can be done iteratively
    after the main split lands.

### D-007: Admin Pagination Approach

- **Decision**: Offset-based pagination with `p_limit` (default 50) and `p_offset` parameters
  added to existing admin RPCs via a new migration.
- **Rationale**: Simplest approach compatible with current RPC call patterns. Offset pagination
  is adequate at the current scale (< 10k rows).
- **Alternatives considered**:
  - Cursor-based (keyset) pagination: better at scale but requires UI rework and more complex
    SQL. Deferred.

### D-008: Stripe Unknown Price ID Behaviour (existing — now also covered by allowlist in checkout)

- **Decision**: `throw new Error(`Unknown price ID: ${priceId}; credits: 0 NOT applied`)`.
  This returns HTTP 500 to Stripe, causing it to retry the webhook.
- **Rationale**: A thrown error surfaces in Supabase logs immediately. Stripe retry prevents
  event loss. The alternative (returning 200 with 0 credits) silently fails paying customers.
- **Risk**: If Stripe retries accumulate (e.g., misconfigured price during rollout), the team
  must fix the price mapping quickly. This is acceptable — the current silent failure is worse.

### D-009: Subscription Cancellation Clears subscription_tier

- **Decision**: On `customer.subscription.deleted`, set `subscription_tier: "none"` in
  addition to `subscription_status: "canceled"`. One-time top-up credits are preserved.
- **Rationale**: `RequireAuth` gates access on `subscription_tier !== "none"`. Without clearing
  the tier, cancelled subscribers retain indefinite app access.
- **Alternatives considered**: Clear credits too on cancel — rejected; users may have purchased
  top-ups separately that are unrelated to the subscription.

### D-010: Webhook Idempotency via stripe_processed_events Table

- **Decision**: New Postgres table `stripe_processed_events (event_id TEXT PRIMARY KEY)`.
  Check at the start of every credit-applying handler; insert before returning.
- **Rationale**: Simplest approach with zero external dependencies. Stripe guarantees `event.id`
  uniqueness. The PRIMARY KEY constraint prevents race-condition double-inserts.
- **Alternatives considered**: Redis/KV store — no Redis available in Supabase edge functions
  without external setup. Checking `profiles.credits` before/after — fragile, not event-scoped.

### D-011: Price ID Allowlist in create-checkout

- **Decision**: Hardcode the 12 known price IDs as a `Set<string>` constant in
  `create-checkout/index.ts`; return 400 for any unknown ID.
- **Rationale**: The price catalog is small and stable; hardcoding is the simplest approach.
  When new prices are added, the allowlist is updated in the same PR as the UI change.
- **Alternatives considered**: Validate against Stripe API at request time — adds latency and
  an API call; overkill for a small catalog. DB-driven allowlist — over-engineering.

### D-012: Zero-Credit Gate in Generator Page

- **Decision**: Add a credit gate check at the top of `Generator.tsx` using `useCredits()`;
  render the `CreditTopUpModal` trigger inline if `credits === 0 && !unlimited`.
- **Rationale**: The Generator page is the only entry point to job creation; gating here
  prevents users from configuring a full job before discovering they can't submit it.
- **Alternatives considered**: Gate in `RequireAuth` — too early; the user may have credits by
  the time they finish configuring. Gate at job submission — too late; wastes user effort.
