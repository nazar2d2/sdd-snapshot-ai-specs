-- Ensure users can update their own profile (full_name, avatar_url)
-- Some deployments may only have SELECT from 20260120133000_create_profiles.sql
-- This migration guarantees the UPDATE policy exists

DROP POLICY IF EXISTS "Profiles can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Profiles can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
