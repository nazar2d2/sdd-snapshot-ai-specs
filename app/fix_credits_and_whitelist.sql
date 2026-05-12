/*
  FIX CREDITS & WHITELIST VISIBILITY
  Run this script in Supabase SQL Editor to restore "Unlimited" status.
*/

-- 1. Ensure whitelisted_users table exists
CREATE TABLE IF NOT EXISTS public.whitelisted_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.whitelisted_users ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policy: Allow Authenticated Users to READ the whitelist
-- (This fixes the issue where Lovable might have restricted it to service_role only)
DROP POLICY IF EXISTS "Allow authenticated read" ON public.whitelisted_users;
CREATE POLICY "Allow authenticated read"
  ON public.whitelisted_users
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Seed Whitelisted Emails (Safe Upsert)
INSERT INTO public.whitelisted_users (email)
VALUES 
  ('maxim@scalemakers.nl'),
  ('quintvanloosdregt01@gmail.com'),
  ('snapshot@gmail.com'),
  ('zakelijkthriveedge@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 5. Force Update Profiles "is_unlimited" flag (Fallback mechanism)
UPDATE public.profiles
SET is_unlimited = TRUE, credits = 999999 -- Visual backup
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN (
    'maxim@scalemakers.nl', 
    'quintvanloosdregt01@gmail.com', 
    'snapshot@gmail.com', 
    'zakelijkthriveedge@gmail.com'
  )
);

-- 6. Re-apply robust get_user_profile function
-- This ensures that even if the client-side query fails, the RPC returns the correct flag.
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  user_email TEXT;
  is_whitelisted_flag BOOLEAN;
  unlimited_flag BOOLEAN;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;

  -- Check whitelist table
  SELECT EXISTS (
    SELECT 1 FROM public.whitelisted_users
    WHERE LOWER(email) = LOWER(user_email)
  ) INTO is_whitelisted_flag;

  -- Check profile flag
  SELECT COALESCE(p.is_unlimited, false)
  INTO unlimited_flag
  FROM public.profiles p
  WHERE p.id = user_id;

  -- Combine logic: Either in whitelist table OR has profile flag
  unlimited_flag := (COALESCE(is_whitelisted_flag, false) OR COALESCE(unlimited_flag, false));

  -- Build result
  SELECT json_build_object(
    'credits', CASE WHEN unlimited_flag THEN 999999999 ELSE COALESCE(p.credits, 0) END,
    'subscription_tier', COALESCE(p.subscription_tier, 'none'),
    'stripe_customer_id', p.stripe_customer_id,
    'subscription_status', p.subscription_status,
    'current_period_end', p.current_period_end,
    'is_whitelisted', COALESCE(is_whitelisted_flag, false),
    'is_unlimited', unlimited_flag
  ) INTO result
  FROM public.profiles p
  WHERE p.id = user_id;

  -- Default fallback if no profile found
  IF result IS NULL THEN
    result := json_build_object(
      'credits', CASE WHEN unlimited_flag THEN 999999999 ELSE 0 END,
      'subscription_tier', 'none',
      'stripe_customer_id', NULL,
      'subscription_status', NULL,
      'current_period_end', NULL,
      'is_whitelisted', COALESCE(is_whitelisted_flag, false),
      'is_unlimited', unlimited_flag
    );
  END IF;

  RETURN result;
END;
$function$;

-- 7. Force Schema Cache Reload (Just in case)
NOTIFY pgrst, 'reload schema';
