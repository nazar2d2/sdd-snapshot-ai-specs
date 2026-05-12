# Data Model: snap-shot.ai Phase 3

**Feature**: 001-snapshot-ai-rebuild
**Date**: 2026-05-12

## Existing Tables (unchanged schema — behaviour changes only)

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | FK → auth.users |
| credits | int | Decremented via `decrement_credits` RPC |
| is_admin | boolean | **The sole gate for admin access** — no email bypass |
| is_unlimited | boolean | Bypass credit checks when true (column name is `is_unlimited`, set in migration `20260120200000_add_unlimited_flag.sql`) |
| subscription_tier | text | `"none"` blocks app access in `RequireAuth`; cleared on cancel by US10 |
| subscription_status | text | `"active"` / `"canceled"` — status only; tier is the access gate |
| stripe_customer_id | text | Nullable |
| avatar_url | text | Nullable; storage path |
| display_name | text | Nullable |

**Phase 3 change**: Application code no longer checks email strings for admin access.
The `is_admin` column is the only gate. Migrations that seed `snapshot@gmail.com` as an
admin MUST be superseded by a migration that sets `is_admin = true` for that account via
its UUID instead.

**Billing fix (US10/US13)**: `subscription_tier` MUST be set to `"none"` on subscription
cancellation (alongside `subscription_status: "canceled"`). The `useCredits` hook MUST
also read the `is_unlimited` column so the frontend correctly bypasses credit checks for
unlimited accounts.

---

### `generation_jobs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid | FK → profiles |
| status | text | pending / running / completed / failed |
| model | text | Locked at job creation (Phase 1 fix) |
| product_config | jsonb | Locked at job creation |
| color_config | jsonb | Locked at job creation |
| task_count | int | Total tasks in this job |
| completed_count | int | Completed tasks |
| failed_count | int | Failed tasks |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Phase 3 change**: None to schema. The HD pending-state logic operates on `generation_tasks`
rows, not `generation_jobs`.

---

### `generation_tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| job_id | uuid | FK → generation_jobs |
| view | text | e.g., "front", "back", "side" |
| variant | text | e.g., "color_1", "anchor" |
| status | text | pending / claimed / completed / failed |
| attempt_count | int | Incremented (never reset) on retry |
| result_url | text | **Storage path only** — never a signed URL |
| claimed_at | timestamptz | Nullable |
| completed_at | timestamptz | Nullable |
| created_at | timestamptz | |

**Phase 3 change**: The `handleWork` named handler reads `result_url` as a storage path and
calls the Phase 2 `signStoragePathOrUrl` helper at display time.

---

## New Migration: `20260512_stripe_processed_events.sql`

Adds an idempotency table for Stripe webhook events. Written before credit application;
prevents double-crediting on Stripe retries.

```sql
CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id    TEXT        PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Only the service role key may insert rows (edge function uses service role)
ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON stripe_processed_events
  USING (false)
  WITH CHECK (false);
-- Service role bypasses RLS by design in Supabase
```

---

## New Migration: `20260512_admin_pagination_rpcs.sql`

### Updated RPC: `admin_get_users`

```sql
-- Drop old signature, create paginated version
CREATE OR REPLACE FUNCTION admin_get_users(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users JSON;
  v_total BIGINT;
BEGIN
  -- Admin check
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_total FROM profiles;

  SELECT json_build_object(
    'users', (
      SELECT json_agg(row_to_json(u))
      FROM (
        SELECT id, email, display_name, credits, is_admin, is_unlimited,
               stripe_customer_id, created_at
        FROM profiles
        ORDER BY created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) u
    ),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  ) INTO v_users;

  RETURN v_users;
END;
$$;
```

### Updated RPC: `admin_get_jobs`

```sql
CREATE OR REPLACE FUNCTION admin_get_jobs(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jobs JSON;
  v_total BIGINT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_total FROM generation_jobs;

  SELECT json_build_object(
    'jobs', (
      SELECT json_agg(row_to_json(j))
      FROM (
        SELECT id, user_id, status, model, task_count, completed_count,
               failed_count, created_at, updated_at
        FROM generation_jobs
        ORDER BY created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) j
    ),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  ) INTO v_jobs;

  RETURN v_jobs;
END;
$$;
```

---

## New Shared Utility: `supabase/functions/_shared/cors.ts`

This is not a DB entity but a shared module used by all admin edge functions.

```typescript
/**
 * Build CORS headers restricted to SITE_URL.
 * Falls back to deny-all ("null") if SITE_URL is not configured.
 */
export function buildCorsHeaders(): Record<string, string> {
  const siteUrl = Deno.env.get("SITE_URL");
  if (!siteUrl) {
    console.warn("[CORS] SITE_URL env var not set — using deny-all origin");
  }
  return {
    "Access-Control-Allow-Origin": siteUrl ?? "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}
```

---

## Entity Relationship Summary (unchanged)

```
auth.users (Supabase managed)
    │
    └── profiles (1:1)
            │
            └── generation_jobs (1:N)
                        │
                        └── generation_tasks (1:N)
```

No new relationships introduced in Phase 3.
