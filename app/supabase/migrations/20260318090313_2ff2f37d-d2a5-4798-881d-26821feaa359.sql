DROP POLICY IF EXISTS "Users can only view their own whitelist entry" ON public.whitelisted_users;

CREATE POLICY "Users can only view their own whitelist entry"
  ON public.whitelisted_users
  FOR SELECT TO public
  USING (lower(email) = lower(auth.jwt() ->> 'email'));