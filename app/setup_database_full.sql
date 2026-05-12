/* 
  MASTER SETUP SCRIPT
  Run this entire script in your Supabase SQL Editor to verify/setup your database.
  It is idempotent (safe to run multiple times) where possible.
*/

-- 1. Create profiles table (if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  subscription_tier TEXT DEFAULT 'none',
  stripe_customer_id TEXT,
  subscription_status TEXT,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 1b. Add is_unlimited column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_unlimited') THEN
        ALTER TABLE public.profiles ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Drop to ensure clean state or use IF NOT EXISTS logic
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

-- 4. Triggers for new users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  should_be_unlimited BOOLEAN := FALSE;
BEGIN
  -- Check if the email matches one of the VIPs
  IF LOWER(new.email) IN (
    'maxim@scalemakers.nl', 
    'quintvanloosdregt01@gmail.com', 
    'snapshot@gmail.com', 
    'zakelijkthriveedge@gmail.com'
  ) THEN
    should_be_unlimited := TRUE;
  END IF;

  INSERT INTO public.profiles (id, credits, subscription_tier, is_unlimited)
  VALUES (new.id, 0, 'none', should_be_unlimited);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill existing users
INSERT INTO public.profiles (id, credits, subscription_tier, is_unlimited)
SELECT id, 0, 'none', false
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id);

-- 6. RPC: Decrement Credits
CREATE OR REPLACE FUNCTION public.decrement_credits(user_id UUID, amount INTEGER DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  SELECT credits INTO current_credits FROM public.profiles WHERE id = user_id FOR UPDATE;
  
  IF current_credits >= amount THEN
    UPDATE public.profiles SET credits = credits - amount WHERE id = user_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- 7. RPC: Get User Profile (Updated Version)
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'credits', COALESCE(p.credits, 0),
    'subscription_tier', COALESCE(p.subscription_tier, 'none'),
    'stripe_customer_id', p.stripe_customer_id,
    'subscription_status', p.subscription_status,
    'current_period_end', p.current_period_end,
    'is_unlimited', COALESCE(p.is_unlimited, false)
  ) INTO result
  FROM public.profiles p
  WHERE p.id = user_id;
  
  IF result IS NULL THEN
    result := json_build_object(
      'credits', 0,
      'subscription_tier', 'none',
      'stripe_customer_id', NULL,
      'subscription_status', NULL,
      'current_period_end', NULL,
      'is_unlimited', false
    );
  END IF;
  
  RETURN result;
END;
$$;

-- 8. Seed Whitelist Data
UPDATE public.profiles
SET is_unlimited = TRUE
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN (
    'maxim@scalemakers.nl', 
    'quintvanloosdregt01@gmail.com', 
    'snapshot@gmail.com', 
    'zakelijkthriveedge@gmail.com'
  )
);
