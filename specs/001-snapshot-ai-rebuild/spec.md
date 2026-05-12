# Feature Specification: snap-shot.ai Phase 3 — Stability, Security & Rebuild

**Feature Branch**: `001-snapshot-ai-rebuild`
**Created**: 2026-05-12
**Status**: Draft
**Project**: snap-shot.ai — AI Image Generation SaaS

---

## Overview

snap-shot.ai is a credit-based AI image generation SaaS. Users upload product photos, choose
a niche (fashion, home decor), configure variants and colour options, and receive AI-generated
lifestyle images powered by Google Vertex AI (Gemini). Payments are handled by Stripe;
authentication, database, storage, and edge functions are hosted on Supabase.

Phases 1 (core pipeline reliability) and 2 (data integrity) are **complete**. This spec covers
Phase 3 and the remaining security and tech-debt work that must be done before the product is
considered production-grade.

---

## User Scenarios & Testing

### User Story 1 — HD Generation Produces a Clear Status on Anchor-Not-Ready (Priority: P1)

A logged-in user who triggers HD generation while the standard anchor image is still processing
should receive a clear, actionable pending or retry message — not a silent empty result or a
broken loading state that never resolves.

**Why this priority**: HD generation is a paid-tier differentiator. Silent failures on this path
erode trust and generate support tickets. Multiple regressions have been recorded in git history.

**Independent Test**: Navigate to the Generator → complete a Fashion or Home Decor flow →
trigger HD generation before the anchor image has fully uploaded → verify the UI shows a
"still processing" or "retry in a moment" state rather than an empty result or frozen loader.

**Acceptance Scenarios**:

1. **Given** a user submits an HD generation request, **When** the anchor image task is not yet
   in `completed` status, **Then** the edge function returns a structured `{ status: "pending",
   retryAfterMs: N }` response and the client shows a human-readable "generating your anchor
   image first" message.

2. **Given** the anchor image completes within the retry window, **When** the client retries,
   **Then** HD generation proceeds normally and the result images appear in the gallery.

3. **Given** the anchor image permanently fails, **When** the HD flow detects the failure,
   **Then** the job is marked `failed` and the user sees an error toast with a retry option —
   no frozen spinner.

---

### User Story 2 — Admin Access Enforced by Database Role, Not Hardcoded Email (Priority: P1)

An admin can log in and access the admin dashboard (`/admin`) only when the `profiles.is_admin`
database flag is `true` for their account. No hardcoded email address grants admin access.

**Why this priority**: The current `snapshot@gmail.com` hardcoded fallback is a HIGH security
issue. Any compromise of that email address grants full admin access to all user data and the
credit system.

**Independent Test**: Remove the `snapshot@gmail.com` hardcoded check from `RequireAdmin.tsx`
and the DB migrations → confirm that an account not flagged in `profiles` is denied access →
confirm that a DB-flagged admin account retains access.

**Acceptance Scenarios**:

1. **Given** a user whose `profiles.is_admin` is `false`, **When** they navigate to `/admin`,
   **Then** they are redirected to `/admin/login` regardless of their email address.

2. **Given** a user whose `profiles.is_admin` is `true`, **When** they navigate to `/admin`,
   **Then** they see the full admin dashboard.

3. **Given** the hardcoded email is removed from all code files, **When** a security scan is run,
   **Then** no literal `snapshot@gmail.com` appears in any `.ts`, `.tsx`, or `.sql` file in the
   production codebase.

---

### User Story 3 — Admin Edge Functions Restrict CORS to Production Domain (Priority: P1)

Admin-scoped edge functions (`admin-create-user`, `admin-delete-user`, `admin-purchases`,
`admin-whitelist`) return CORS headers limited to the configured `SITE_URL` environment variable,
not the wildcard `*`.

**Why this priority**: Wildcard CORS on admin endpoints allows any origin to make authenticated
requests, bypassing browser same-origin protections.

**Independent Test**: Deploy updated edge functions to a staging environment → send a preflight
OPTIONS request from an arbitrary origin → verify `Access-Control-Allow-Origin` is the
production domain, not `*`.

**Acceptance Scenarios**:

1. **Given** an OPTIONS preflight from `https://attacker.example.com`, **When** the admin edge
   function responds, **Then** `Access-Control-Allow-Origin` is NOT `*` and the origin is not
   reflected.

2. **Given** an OPTIONS preflight from the configured `SITE_URL`, **When** the admin edge
   function responds, **Then** the CORS headers permit the request normally.

3. **Given** `SITE_URL` is not set, **When** the edge function starts, **Then** it falls back to
   a safe deny-all CORS posture and logs a warning.

---

### User Story 4 — WASM ImageScript Loaded Lazily (Priority: P2)

The WASM ImageScript module is imported only on invocations that actually use image processing,
reducing cold-start latency for non-processing actions (e.g., `create_job`, `work` without image
ops, `get_results`).

**Why this priority**: Cold-start latency directly increases time-to-first-image for users and
increases Supabase edge function billing.

**Independent Test**: Instrument or log the WASM load event → invoke `generate-image` with
`action: "create_job"` → verify the WASM module is NOT loaded → invoke with a task that requires
image encoding → verify WASM IS loaded.

**Acceptance Scenarios**:

1. **Given** a `create_job` action request, **When** the edge function handles it, **Then**
   the WASM ImageScript module has not been initialised in that invocation.

2. **Given** a `work` action that produces an image requiring WASM encoding, **When** the
   function executes, **Then** WASM is loaded exactly once and image processing completes
   successfully.

---

### User Story 5 — generate-image God-Function Extracted into Named Handlers (Priority: P2)

The three most fragile code paths in `generate-image/index.ts` — stale task recovery, credit
deduction, and job creation — each live in a named extracted function. No new logic is added
directly to the top-level `switch(action)` block.

**Why this priority**: The god-function has been the source of every P0 regression. Extracting
named handlers makes each path independently readable, testable, and fixable.

**Independent Test**: Read `generate-image/index.ts` → confirm the `switch` block only calls
named functions → confirm the three named handlers exist with JSDoc comments explaining their
contract.

**Acceptance Scenarios**:

1. **Given** the refactored edge function is deployed, **When** a standard generation job runs,
   **Then** all behaviour is identical to pre-refactor (no regression).

2. **Given** a credit deduction failure occurs, **When** the named handler runs, **Then** it
   throws an observable error (same behaviour as CREDIT-01 fix) rather than silently returning.

3. **Given** a code reviewer opens `generate-image/index.ts`, **When** they look at the switch
   block, **Then** each case delegates to a function named after the action (e.g.,
   `handleCreateJob`, `handleWork`, `handleGetResults`).

---

### User Story 6 — Admin Dashboard Split into Tabbed Sub-Components (Priority: P2)

`Admin.tsx` (2513 lines) is decomposed into separate components — one per admin tab (Users,
Jobs, Analytics, Whitelist, Purchases) — each in its own file under `src/components/admin/`.

**Why this priority**: The monolithic component makes every admin change a high-risk edit.
Splitting it eliminates the chance of accidental cross-tab state pollution and reduces review
burden.

**Independent Test**: Open each admin tab in the UI → verify all tab functionality works
identically to pre-split → confirm `Admin.tsx` delegates to sub-components rather than
containing inline JSX for each tab.

**Acceptance Scenarios**:

1. **Given** the refactored admin page is loaded, **When** a user navigates between tabs,
   **Then** all data loads correctly with no regressions.

2. **Given** a developer opens `src/pages/Admin.tsx`, **When** they read it, **Then** it is
   under 150 lines and contains only tab routing logic — no inline business UI.

3. **Given** `src/components/admin/` exists, **When** listed, **Then** it contains at least
   five files: `UsersTab.tsx`, `JobsTab.tsx`, `AnalyticsTab.tsx`, `WhitelistTab.tsx`,
   `PurchasesTab.tsx`.

---

### User Story 7 — Dead Code Removed and Orphaned Files Deleted (Priority: P2)

Orphaned files that add confusion and inflate the build are deleted: `src/pages/Index.tsx`,
`supabase/functions/_shared/fal-vision-adapter.ts`, and `tailwind.config copy.ts`.

**Why this priority**: Dead code misleads contributors and adds to bundle size.

**Independent Test**: Run `npm run build` — confirm no errors related to the deleted files →
confirm the three files no longer exist.

**Acceptance Scenarios**:

1. **Given** the dead files are deleted, **When** `npm run build` runs, **Then** the build
   succeeds without errors.

2. **Given** the files are deleted, **When** a full-text search is run for `Index.tsx` imports,
   **Then** no component imports it.

---

### User Story 8 — Stripe Unknown Price ID Throws Observable Error (Priority: P3)

When the Stripe webhook receives a `checkout.session.completed` event with a price ID not in
the credit map, the function throws an error (or sends an alert) rather than silently crediting
0 units to the customer.

**Why this priority**: Customers paying with an unrecognised price ID get no credits — a revenue
and trust issue. The current silent zero-fallback makes this invisible.

**Independent Test**: Send a test Stripe webhook event with a known-unknown `price_id` →
verify an error is thrown and logged, NOT that 0 credits are silently applied.

**Acceptance Scenarios**:

1. **Given** a Stripe event with an unrecognised price ID, **When** the webhook handler runs,
   **Then** it throws/returns a 500 with a structured error log entry and does not credit 0.

2. **Given** a recognised price ID, **When** the webhook handler runs, **Then** credits are
   applied as before with no change in behaviour.

---

### User Story 10 — Subscription Cancellation Fully Revokes Access (Priority: P1)

When a customer cancels their Stripe subscription, their `subscription_tier` is reset to `"none"`
in addition to `subscription_status` being set to `"canceled"`. This prevents cancelled
subscribers from continuing to access the app through the tier-based auth gate.

**Why this priority**: Currently `RequireAuth` grants access based on `subscription_tier !== "none"`.
Without clearing the tier on cancel, a cancelled subscriber retains app access indefinitely.
This is a billing integrity issue — cancelled customers should not generate images for free.

**Independent Test**: Cancel a test subscription in Stripe → verify `profiles.subscription_tier`
becomes `"none"` → navigate to `/app` as that user → confirm redirect to `/pricing`.

**Acceptance Scenarios**:

1. **Given** Stripe fires `customer.subscription.deleted`, **When** the webhook handler runs,
   **Then** `profiles.subscription_status` is `"canceled"` AND `profiles.subscription_tier`
   is `"none"` for the affected user.

2. **Given** a user whose subscription was just cancelled, **When** they navigate to `/app`,
   **Then** `RequireAuth` redirects them to `/pricing` — not the generator.

3. **Given** a user who cancels but has remaining credits from a top-up, **When** their
   subscription is cancelled, **Then** their credit balance is preserved (cancellation affects
   tier access, not one-time top-up credits).

---

### User Story 11 — Stripe Webhook Idempotent Credit Application (Priority: P1)

Credit additions from Stripe webhook events are idempotent: if Stripe retries a webhook event
(e.g., after a timeout), the credits are applied exactly once, not doubled.

**Why this priority**: Stripe retries webhooks on 5xx responses or timeouts. Without an
idempotency guard, a slow DB write followed by a Stripe retry can double the credits applied
to a paying customer's account — a direct revenue leak.

**Independent Test**: Replay the same Stripe webhook event ID twice → verify the user's
credit balance increased only once.

**Acceptance Scenarios**:

1. **Given** a `checkout.session.completed` event with ID `evt_ABC123` is processed successfully,
   **When** Stripe sends the same event again, **Then** credits are NOT applied a second time
   and the webhook returns HTTP 200.

2. **Given** the webhook handler encounters a DB error mid-processing, **When** Stripe retries,
   **Then** credits are applied on the retry (the failed first attempt was not recorded as
   processed).

3. **Given** the `stripe_processed_events` table exists, **When** any credit-applying webhook
   is handled, **Then** the Stripe event ID is written to the table before the function returns.

---

### User Story 12 — Checkout Validates Price ID Server-Side (Priority: P1)

The `create-checkout` edge function validates that the supplied `priceId` is in the known
allowlist before creating a Stripe checkout session. Unknown price IDs are rejected with a
400 error.

**Why this priority**: The frontend currently passes `priceId` to the backend without server
validation. An attacker could supply a Stripe price ID from another account or a $0 test price,
bypassing the payment intent.

**Independent Test**: Call `create-checkout` with an arbitrary non-catalog `priceId` →
confirm HTTP 400 response → confirm no Stripe checkout session was created.

**Acceptance Scenarios**:

1. **Given** a request to `create-checkout` with a `priceId` not in the server-side allowlist,
   **When** the function runs, **Then** it returns HTTP 400 `{"error": "Invalid price ID"}` and
   no Stripe session is created.

2. **Given** a request with a valid `priceId` from the catalog, **When** the function runs,
   **Then** behaviour is identical to the current flow — no regression.

3. **Given** a new price is added to Stripe, **When** the allowlist constant is updated in the
   edge function source, **Then** checkout works for the new price without other changes.

---

### User Story 13 — Zero-Credit Users See an Actionable Gate (Priority: P2)

Users on a paid tier who have exhausted their credits see a clear "you're out of credits"
message with a top-up option when they open the Generator, rather than proceeding into the
flow and failing at generation time with a cryptic error.

**Why this priority**: Users who burn through their credits currently reach the generator,
configure their full job, submit it, and only discover the error deep in the loading flow.
This is a poor UX and wastes a generation attempt. The `useCredits` hook also does not read
the `unlimited` flag, causing unlimited users to see a "0 credits" display.

**Independent Test**: Set `profiles.credits = 0` and `profiles.is_unlimited = false` for a
paid-tier test account → open `/app` → confirm a "Top up credits" banner or modal appears
before the generation form → confirm unlimited users with 0 credits displayed are unaffected.

**Acceptance Scenarios**:

1. **Given** a paid-tier user with `credits = 0` and `is_unlimited = false`, **When** they
   open the Generator (`/app`), **Then** a "You've used all your credits" banner is shown
   with a "Top up" CTA — the generation form is hidden or disabled.

2. **Given** an `is_unlimited = true` user, **When** they open the Generator regardless of
   their credit count, **Then** no credit gate is shown and generation proceeds normally.

3. **Given** `useCredits` is called for any user, **When** the profile is loaded, **Then** the
   `is_unlimited` flag is included in the returned data and exposed to the UI.

---

### User Story 9 — Admin Pagination is Server-Side (Priority: P3)

Admin tables (Users, Jobs) use server-side pagination (e.g., 50 rows per page with cursor or
offset) rather than fetching up to 250/200 rows client-side.

**Why this priority**: As data grows, the current approach will degrade admin dashboard
performance and hit Supabase row limits.

**Independent Test**: Confirm the admin RPCs accept `limit` and `offset` (or cursor) parameters
→ confirm the admin UI shows a pagination control → confirm only one page of data is loaded
on mount.

**Acceptance Scenarios**:

1. **Given** the Users tab loads, **When** the page opens, **Then** at most 50 user rows are
   fetched, and a "next page" control is visible when more rows exist.

2. **Given** a user clicks "next page", **When** the new page loads, **Then** the next 50 rows
   appear without a full page reload.

---

### Edge Cases

- What happens when a generation job is created but the Supabase Storage bucket does not exist?
  The edge function MUST surface a 500 error, not hang.
- What happens when `SITE_URL` env var is missing from an admin edge function deployment?
  Fall back to deny-all CORS and log a startup warning.
- What happens when an HD generation anchor image upload partially succeeds (some variants
  complete, others time out)? The partial success state MUST be correctly reflected in the
  job status — not treated as full success or full failure.
- What happens when the Stripe webhook secret is rotated and the old secret is briefly still
  in use? The `constructEventAsync` call will fail — this MUST return 400 and log the
  rotation context, not 500.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST determine admin access exclusively via the `is_admin()` database RPC
  and `profiles.is_admin` flag — no hardcoded email addresses.
- **FR-002**: Admin-scoped edge functions MUST restrict CORS to the `SITE_URL` env var value.
- **FR-003**: HD generation MUST return a structured pending/retry response when the anchor
  image is not yet ready, rather than a silent empty or frozen state.
- **FR-004**: The WASM ImageScript module MUST be loaded lazily — only on invocations that
  perform image encoding operations.
- **FR-005**: The stale task recovery, credit deduction, and job creation logic MUST each live
  in a named extracted function in `generate-image/index.ts`.
- **FR-006**: `Admin.tsx` MUST be decomposed into per-tab sub-components under
  `src/components/admin/`.
- **FR-007**: Orphaned files (`Index.tsx`, `fal-vision-adapter.ts`, `tailwind.config copy.ts`)
  MUST be deleted.
- **FR-008**: The Stripe webhook MUST throw an observable error (not 0-credit silent fallback)
  for unrecognised price IDs.
- **FR-009**: Admin User and Job tables MUST use server-side pagination.
- **FR-010**: The `useUserImages` hook MUST support pagination and MUST NOT unconditionally fetch
  500 rows on mount.
- **FR-011**: The Stripe `customer.subscription.deleted` webhook handler MUST set
  `subscription_tier` to `"none"` in addition to `subscription_status: "canceled"`.
- **FR-012**: Stripe webhook credit-applying handlers MUST be idempotent — each Stripe event ID
  MUST be recorded in a `stripe_processed_events` table and checked before credits are applied.
- **FR-013**: The `create-checkout` edge function MUST validate the supplied `priceId` against
  a server-side allowlist and return HTTP 400 for any unknown price ID.
- **FR-014**: The `useCredits` hook MUST include the `is_unlimited` flag in its returned data;
  the Generator page MUST show a zero-credit gate when `credits === 0 && !is_unlimited`.

### Key Entities

- **GenerationJob**: A batch image generation request; has `status`, `model`, `product_config`,
  `color_config`, task counts, user ownership.
- **GenerationTask**: An individual image within a job; has `status` (pending/claimed/completed/
  failed), `attempt_count`, `result_url` (storage path, not signed URL), `view`, `variant`.
- **Profile**: User record extending Supabase Auth; has `credits`, `is_admin`, `is_unlimited`
  flag, `subscription_tier`, `subscription_status`, `stripe_customer_id`.
- **AdminAction**: Any destructive admin operation (delete user, adjust credits, whitelist change)
  — MUST be performed via the appropriate admin edge function, never direct DB mutation from
  the frontend.
- **StripeProcessedEvent**: An idempotency record keyed by Stripe event ID; written before
  credits are applied; prevents double-application on webhook retries.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: HD generation produces a visible pending/retry state on anchor-not-ready within
  2 seconds of the client polling — no frozen spinners lasting more than 10 seconds.
- **SC-002**: Zero instances of `snapshot@gmail.com` appear in any TypeScript, TSX, or SQL file
  in the production codebase after the admin security fix ships.
- **SC-003**: WASM module load is absent from cold-start profiling traces for non-image-encoding
  edge function invocations.
- **SC-004**: `generate-image/index.ts` switch block contains zero inline business logic —
  every case delegates to a named function — after the god-function extraction ships.
- **SC-005**: `Admin.tsx` is under 150 lines after the admin decomposition ships.
- **SC-006**: `npm run build` succeeds and the three orphaned files no longer exist in the repo
  after the dead-code cleanup ships.
- **SC-007**: Unknown Stripe price IDs produce a logged error entry and a non-2xx response —
  never 0-credit application.
- **SC-008**: Admin User and Job tables load in under 2 seconds for datasets of 10,000+ rows
  using server-side pagination.
- **SC-009**: A cancelled subscriber's `subscription_tier` is `"none"` within the same Stripe
  webhook event — verified by querying `profiles` immediately after a test cancellation event.
- **SC-010**: Replaying the same Stripe webhook event ID twice results in zero additional
  credits applied to the user's account.
- **SC-011**: Submitting a `create-checkout` request with an arbitrary `priceId` returns HTTP
  400 and no Stripe checkout session URL in the response.

---

## Assumptions

- Supabase project ID `phkwivrcuuvzpgzvvmkv` is the active production project; all migrations
  target this project.
- Phase 1 and Phase 2 fixes are already merged and deployed; this spec does not reopen those
  requirements.
- The `SITE_URL` Supabase secret is set to the production domain (`https://snap-shot.ai`).
- Mobile support is out of scope for this phase; all UI work targets desktop browsers with a
  responsive minimum.
- The email infrastructure (auth-email-hook, process-email-queue) is considered stable and
  out of scope unless a bug is discovered during Phase 3 work.
- The HD model (`gemini-3-pro-image-preview`) is assumed to remain available; model changes
  are handled by updating the `HD_MODEL` constant, not by this spec.
