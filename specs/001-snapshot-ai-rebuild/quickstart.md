# Quickstart: Verify snap-shot.ai Phase 3

**Feature**: 001-snapshot-ai-rebuild
**Date**: 2026-05-12
**Purpose**: Manual verification checklist for each user story acceptance test.

---

## Pre-requisites

```bash
# Ensure migrations are applied
npm run db:push

# Ensure edge functions are deployed
supabase functions deploy generate-image
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
supabase functions deploy admin-purchases
supabase functions deploy admin-whitelist
supabase functions deploy stripe-webhook

# Ensure build passes
npm run build
```

---

## US7 — Dead Code Removed (verify first)

```bash
ls src/pages/Index.tsx 2>&1
# Expected: No such file or directory

ls supabase/functions/_shared/fal-vision-adapter.ts 2>&1
# Expected: No such file or directory

ls "tailwind.config copy.ts" 2>&1
# Expected: No such file or directory

npm run build
# Expected: exits 0 with no errors
```

---

## US2 — Admin Access via DB Role Only

1. In Supabase Dashboard: set `profiles.is_admin = false` for the test admin account.
2. Clear browser session cookies.
3. Log in as that account.
4. Navigate to `/admin`.
5. **Expected**: Redirected to `/admin/login`. No access granted.
6. In Supabase Dashboard: set `profiles.is_admin = true`.
7. Navigate to `/admin`.
8. **Expected**: Admin dashboard loads normally.
9. Run: `rg "snapshot@gmail.com" src/ supabase/ admin_rpc.sql fix_credits_and_whitelist.sql`
10. **Expected**: Zero matches.

---

## US3 — Admin CORS Restricted to SITE_URL

1. Open browser DevTools → Network tab.
2. Navigate to the admin dashboard and perform any action (e.g., view users).
3. Find an `admin-*` function request in the Network tab.
4. Inspect the response headers.
5. **Expected**: `Access-Control-Allow-Origin: https://snap-shot.ai` (your SITE_URL value), NOT `*`.

---

## US1 — HD Generation Pending State

1. Log in as a user with credits.
2. Navigate to `/app` → select Fashion niche.
3. Upload a product image and configure variants.
4. Submit the generation job.
5. Immediately (before standard generation completes) trigger HD generation.
6. **Expected**: UI shows a message like "Generating your anchor image first…" — NOT an empty result or a frozen spinner.
7. Wait for the anchor to complete.
8. **Expected**: HD generation retries automatically and results appear.

---

## US4 — WASM Lazy Load

1. Open Supabase Dashboard → Edge Function Logs for `generate-image`.
2. Trigger a `create_job` action via the Generator UI.
3. Check logs for the invocation.
4. **Expected**: No WASM-related log entries (e.g., no `[WASM]` prefix if temporary log was added).
5. Trigger a full generation (work action with image encoding).
6. **Expected**: WASM loads only during the image-encoding invocation.

---

## US5 — Named Handler Extraction

1. Open `supabase/functions/generate-image/index.ts`.
2. Find the `switch(action)` block (or equivalent routing logic).
3. **Expected**: Each case delegates to a named function:
   - `case "create_job": return handleCreateJob(...)`
   - `case "work": return handleWork(...)`
   - `case "get_results": return handleGetResults(...)`
4. Confirm `handleCreateJob`, `handleWork`, `handleGetResults` exist as named functions with JSDoc.
5. Run a full generation end-to-end to confirm no regression.

---

## US6 — Admin Dashboard Split

1. Open `src/pages/Admin.tsx`.
2. Count lines: `wc -l src/pages/Admin.tsx` → **Expected**: ≤ 150 lines.
3. Check: `ls src/components/admin/`
4. **Expected**: `UsersTab.tsx`, `JobsTab.tsx`, `AnalyticsTab.tsx`, `WhitelistTab.tsx`, `PurchasesTab.tsx` all present.
5. Open each admin tab in the browser → confirm all data loads with no visual regressions.
6. Open Users tab → **Expected**: pagination controls visible; at most 50 rows on load.

---

## US8 — Stripe Unknown Price ID Error

1. In Stripe Dashboard: use the "Send test webhook" feature to send `checkout.session.completed` with a made-up `price_id` (e.g., `price_FAKE123`).
2. Open Supabase Edge Function logs for `stripe-webhook`.
3. **Expected**: An error log entry containing `"Unknown Stripe price ID: price_FAKE123"`.
4. **Expected**: No credits are added to the associated test user.

---

## US10 — Subscription Cancellation Revokes Tier

1. In Stripe Dashboard (test mode): cancel a test subscription for a test user.
2. Wait for the webhook to fire (or replay it from Stripe Dashboard → Webhooks → test event).
3. In Supabase Dashboard: query `profiles` for that user.
4. **Expected**: `subscription_status = "canceled"` AND `subscription_tier = "none"`.
5. Clear session and log in as that user → navigate to `/app`.
6. **Expected**: Redirected to `/pricing` (access revoked).
7. Check the user's credit balance.
8. **Expected**: Credit balance from any one-time top-ups is preserved (not zeroed).

---

## US11 — Webhook Idempotency

1. In Stripe Dashboard: copy an existing `checkout.session.completed` event ID.
2. Use the Stripe CLI or Dashboard to send that exact event to your webhook endpoint twice.
3. Check `profiles.credits` for the affected user.
4. **Expected**: Credits increased exactly once (not doubled).
5. Check the `stripe_processed_events` table.
6. **Expected**: One row with the event ID, one `processed_at` timestamp.

```bash
# Quick DB check
supabase db query "SELECT * FROM stripe_processed_events ORDER BY processed_at DESC LIMIT 5;"
```

---

## US12 — Checkout Price ID Allowlist

```bash
# Test with an unknown price ID (replace URL with your deployed function URL)
curl -X POST https://phkwivrcuuvzpgzvvmkv.supabase.co/functions/v1/create-checkout \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"priceId": "price_FAKE999", "mode": "payment", "successUrl": "https://snap-shot.ai", "cancelUrl": "https://snap-shot.ai"}'
```
**Expected**: HTTP 400 with `{"error": "Invalid price ID"}` — no Stripe session URL in response.

```bash
# Test with a real price ID — should work as before
curl -X POST ... -d '{"priceId": "price_1T3KQABxmnkg2dwfBhJk7HBF", ...}'
```
**Expected**: HTTP 200 with a Stripe checkout URL.

---

## US13 — Zero-Credit Gate

1. In Supabase Dashboard: set `profiles.credits = 0` and `profiles.is_unlimited = false` for
   a test user who has a paid `subscription_tier`.
2. Log in as that user → navigate to `/app`.
3. **Expected**: A "You've used all your credits" message or banner is shown; the generator
   form is hidden or disabled; a "Top up" button is visible.
4. Click "Top up" → **Expected**: `CreditTopUpModal` opens normally.
5. Set `profiles.is_unlimited = true` for a different test user.
6. Open `/app` as that user (even with `credits = 0`).
7. **Expected**: No credit gate shown; generator loads normally.

---

## US9 — useUserImages Pagination

1. Navigate to `/my-images`.
2. Open DevTools → Network tab.
3. Find the Supabase query for user images.
4. **Expected**: Query uses `.range(0, 49)` (or equivalent) — NOT `.limit(500)`.
5. If user has > 50 images: **Expected**: A "Load more" button or next-page control is visible.
6. Click "Load more" → **Expected**: Next 50 images load without full page reload.
