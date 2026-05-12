-- Fix: "permission denied for table users" error on whitelisted_users queries.
-- The previous policy referenced auth.users in a subquery, which the
-- authenticated role cannot access. Replace with auth.jwt() ->> 'email'
-- and add an admin policy so the dashboard can read all entries.

-- Drop the broken policy
DROP POLICY IF EXISTS "Users can only view their own whitelist entry" ON public.whitelisted_users;

-- Recreate: users can see their own entry (no auth.users reference)
CREATE POLICY "Users can view own whitelist entry"
  ON public.whitelisted_users
  FOR SELECT
  TO authenticated
  USING (
    LOWER(email) = LOWER(auth.jwt() ->> 'email')
  );

-- Admin can read all whitelist entries
CREATE POLICY "Admin can view all whitelist entries"
  ON public.whitelisted_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
