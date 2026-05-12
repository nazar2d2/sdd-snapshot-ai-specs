-- Tighten RLS: avoid overly permissive "WITH CHECK (true)" / "USING (true)" on write policies.
-- This keeps whitelist reads possible, but restricts writes to service role only.

DROP POLICY IF EXISTS "Service role can manage whitelist" ON public.whitelisted_users;

CREATE POLICY "Service role can manage whitelist"
ON public.whitelisted_users
FOR ALL
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');
