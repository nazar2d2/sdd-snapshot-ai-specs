# External Integrations

**Analysis Date:** 2026-05-08

## APIs & External Services

**AI Image Generation:**
- Google Vertex AI (Gemini) — all image generation for the core product
  - Adapter: `supabase/functions/_shared/fal-adapter.ts` (named `fal-adapter` historically but now calls Vertex AI)
  - Default model: `gemini-2.5-flash-image`
  - HD model: `gemini-3-pro-image-preview` (uses global endpoint)
  - Region: `us-central1`
  - Auth: Service account JSON via `GOOGLE_SERVICE_ACCOUNT_JSON` env var; OAuth2 JWT exchanged for access token at runtime
  - Override: `VERTEX_PROJECT_ID` env var (falls back to `project_id` in service account JSON)
  - Optional legacy key: `GOOGLE_AI_API_KEY` (noted as optional in `generate-image/index.ts`)
  - Endpoints: `https://us-central1-aiplatform.googleapis.com/...` (regional) and `https://aiplatform.googleapis.com/...` (global for specific models)
  - Retry budget: 5 retries for 1K renders, 1 retry for 2K/HD renders
  - Timeouts: 60s for standard, 120s for HD renders

**Payments:**
- Stripe — subscription billing and one-time credit top-ups
  - SDK: `npm:stripe@14.21.0` (Edge Functions), no frontend Stripe SDK detected
  - API version: `2023-10-16`
  - Auth: `STRIPE_SECRET_KEY` env var
  - Webhook secret: `STRIPE_WEBHOOK_SECRET` env var
  - Used in: `supabase/functions/create-checkout/index.ts`, `supabase/functions/stripe-webhook/index.ts`
  - Subscription tiers (by monthly amount in cents): Basic $10 (75 credits), Starter $28.95 (250 credits), Advanced $49.95 (500 credits), Generator $124.95 (1000 credits)
  - Top-up tiers: $10 (50 credits), $25 (150 credits), $50 (350 credits), $99 (750 credits)
  - Credit multiplier for metadata lookup: checks `product.metadata.credits` first, falls back to hardcoded price map

**Email Delivery:**
- Lovable Email API — transactional email sending
  - SDK: `npm:@lovable.dev/email-js` (Edge Functions)
  - Auth: `LOVABLE_API_KEY` env var
  - Send URL override: `LOVABLE_SEND_URL` env var (optional; defaults to `https://api.lovable.dev`)
  - Used in: `supabase/functions/process-email-queue/index.ts`
  - Webhook verification: `npm:@lovable.dev/webhooks-js` (in `auth-email-hook`)
  - Email templates rendered server-side via `@react-email/components` in `supabase/functions/auth-email-hook/index.ts`
  - Sender domain: `notify.snap-shot.ai`; from address domain: `snap-shot.ai`

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Connection (frontend): `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
  - Connection (Edge Functions): `SUPABASE_URL` + `SUPABASE_ANON_KEY` (user-scoped) or `SUPABASE_SERVICE_ROLE_KEY` (admin)
  - Client: `@supabase/supabase-js` v2.89.x (frontend), `npm:@supabase/supabase-js@2.39.3` (Edge Functions)
  - Frontend client: `src/integrations/supabase/client.ts` — persists session in `localStorage`, auto-refreshes token
  - Generated types: `src/integrations/supabase/types.ts`
  - Key tables (from Edge Function queries):
    - `profiles` — user profile, credits balance, subscription status, `stripe_customer_id`
    - `generation_jobs` — image generation jobs with status, task counts, model lock, config
    - `generation_tasks` — individual image tasks per job (view, variant, status, result_url)
    - `email_send_log` — transactional email delivery log
    - `email_send_state` — rate-limit cooldown state for email queue
  - Key RPCs: `decrement_credits`, `reap_stale_jobs`, `enqueue_email`, `move_to_dlq`, `delete_email`, `read_email_batch`
  - Migrations: `supabase/migrations/` (20+ migration files, starting 2025-12-27)

**File Storage:**
- Supabase Storage — generated images bucket
  - Bucket name: `generated-images` (private, created on-demand)
  - Paths: `jobs/{jobId}/product.{ext}`, `jobs/{jobId}/{view}/{variant}.{ext}`, `{userId}/anchor-cache/{modelKey}.png`, `{userId}/tmp/{uuid}.png`
  - Access: signed URLs with 24h expiry for generated images, 1h for temp uploads
  - Operations in: `supabase/functions/generate-image/index.ts`

**Caching:**
- None detected (no Redis, Memcached, or equivalent)
- In-memory OAuth2 token caching in `fal-adapter.ts` (module-scoped `cachedToken`)

**Message Queue:**
- Supabase pgmq (PostgreSQL-backed queue) — async email dispatch
  - Queues: `auth_emails` (priority), `transactional_emails`
  - Dead letter queues: `auth_emails_dlq`, `transactional_emails_dlq`
  - Batch size, send delay, TTL configurable via `email_send_state` table

## Authentication & Identity

**Auth Provider:**
- Supabase Auth — email/password, magic link, OAuth
  - Email hook: `supabase/functions/auth-email-hook/index.ts` — intercepts all auth emails, renders branded React Email templates, enqueues for async delivery
  - JWT verified at Edge Function gateway (Supabase `verify_jwt` setting per function in `supabase/config.toml`)
  - Session persistence: `localStorage` on frontend (`src/integrations/supabase/client.ts`)
  - Password reset page: `src/pages/ResetPassword.tsx`
  - Auth page: `src/pages/Auth.tsx`

**Authorization:**
- Credit-based access control — `profiles.credits` column, decremented via `decrement_credits` RPC on successful generation
- Admin whitelist — referenced in `fix_credits_and_whitelist.sql` and `admin_rpc.sql`
- `profiles.unlimited` flag — users with unlimited flag bypass credit checks (migration: `20260120200000_add_unlimited_flag.sql`)

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, or equivalent)

**Logs:**
- `console.log` / `console.error` throughout Edge Functions with structured prefixes (e.g., `[WORK]`, `[TASK]`, `[AUTH]`, `[VERTEX]`, `[STRIPE]`)
- Supabase Edge Function logs visible in Supabase dashboard

## CI/CD & Deployment

**Hosting:**
- Frontend: Lovable platform (inferred from `lovable-tagger` dev dependency and `imagifygenimagegpt.lovable.app` in email sample data)
- Backend: Supabase cloud (project ID: `phkwivrcuuvzpgzvvmkv`)

**CI Pipeline:**
- Not detected — no GitHub Actions, CircleCI, or similar config found

**Database Scripts:**
- `scripts/db.js` — local DB management helper (`npm run db:link`, `npm run db:push`, `npm run db:migrate`)
- SQL scripts: `setup_database_full.sql`, `setup_generation_tables.sql`, `admin_rpc.sql`, `fix_credits_and_whitelist.sql`

## Webhooks & Callbacks

**Incoming:**
- Stripe webhook: `supabase/functions/stripe-webhook/index.ts`
  - Events handled: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`
  - Verified via `stripe.webhooks.constructEventAsync()` with `STRIPE_WEBHOOK_SECRET`
  - Function has `verify_jwt = false` (receives unauthenticated POST from Stripe)

- Auth email hook: `supabase/functions/auth-email-hook/index.ts`
  - Triggered by Supabase Auth on signup, magic link, password recovery, email change, reauthentication, invite
  - Signature verified via `@lovable.dev/webhooks-js` using `LOVABLE_API_KEY`
  - Function has `verify_jwt = false`

**Outgoing:**
- Lovable Email API: called from `supabase/functions/process-email-queue/index.ts` to send transactional emails
- Google Vertex AI: called from `supabase/functions/_shared/fal-adapter.ts` for image generation
- Stripe API: called from `supabase/functions/create-checkout/index.ts` and `stripe-webhook/index.ts`

## Environment Configuration

**Required frontend env vars (VITE_ prefix):**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key

**Required Edge Function env vars (Supabase secrets):**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (admin operations)
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `GOOGLE_SERVICE_ACCOUNT_JSON` — GCP service account JSON (contains `project_id`, `client_email`, `private_key`)
- `LOVABLE_API_KEY` — Lovable platform API key (email sending + webhook verification)

**Optional Edge Function env vars:**
- `VERTEX_PROJECT_ID` — override GCP project ID (otherwise read from service account JSON)
- `GOOGLE_AI_API_KEY` — legacy, noted as optional in `generate-image/index.ts`
- `LOVABLE_SEND_URL` — override Lovable email send endpoint for local dev

**Secrets location:**
- Frontend: `.env` file (gitignored); `.env.example` documents required keys
- Edge Functions: Supabase project secrets (set via `supabase secrets set`)

---

*Integration audit: 2026-05-08*
