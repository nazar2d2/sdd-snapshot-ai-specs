-- Create profiles table (used for credits/subscriptions)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  subscription_tier TEXT NOT NULL DEFAULT 'none',
  stripe_customer_id TEXT NULL,
  subscription_status TEXT NULL,
  current_period_end TIMESTAMPTZ NULL,
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies (drop + recreate safely)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles can view own profile'
  ) THEN
    DROP POLICY "Profiles can view own profile" ON public.profiles;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles can insert own profile'
  ) THEN
    DROP POLICY "Profiles can insert own profile" ON public.profiles;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles can update own profile'
  ) THEN
    DROP POLICY "Profiles can update own profile" ON public.profiles;
  END IF;
END $$;

CREATE POLICY "Profiles can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Profiles can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- updated_at trigger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='update_profiles_updated_at'
  ) THEN
    DROP TRIGGER update_profiles_updated_at ON public.profiles;
  END IF;
END $$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Credit decrement function (service_role only)
CREATE OR REPLACE FUNCTION public.decrement_credits(user_id UUID, amount INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_credits INTEGER;
  unlimited_flag BOOLEAN;
  jwt_role TEXT;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), '');
  IF jwt_role <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- ensure row exists
  INSERT INTO public.profiles (id, credits)
  VALUES (user_id, 0)
  ON CONFLICT (id) DO NOTHING;

  SELECT credits, is_unlimited INTO current_credits, unlimited_flag
  FROM public.profiles
  WHERE id = user_id;

  IF COALESCE(unlimited_flag, false) THEN
    RETURN true;
  END IF;

  IF COALESCE(current_credits, 0) < amount THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET credits = credits - amount
  WHERE id = user_id;

  RETURN true;
END;
$$;

-- Update get_user_profile to also return is_unlimited and treat whitelisted as unlimited
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
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;

  -- Check if whitelisted
  SELECT EXISTS (
    SELECT 1 FROM public.whitelisted_users
    WHERE LOWER(email) = LOWER(user_email)
  ) INTO is_whitelisted_flag;

  -- Determine unlimited flag (whitelist OR profile flag)
  SELECT COALESCE(p.is_unlimited, false)
  INTO unlimited_flag
  FROM public.profiles p
  WHERE p.id = user_id;

  unlimited_flag := (COALESCE(is_whitelisted_flag, false) OR COALESCE(unlimited_flag, false));

  -- Build result if profile exists
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

  -- If no profile exists, return defaults
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