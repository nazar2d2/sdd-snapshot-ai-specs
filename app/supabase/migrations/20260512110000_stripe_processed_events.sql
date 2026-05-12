-- Idempotency for Stripe webhook: same event_id must not apply credits twice.

CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.stripe_processed_events IS 'Stripe webhook dedupe; only service role should insert/select.';

NOTIFY pgrst, 'reload schema';
