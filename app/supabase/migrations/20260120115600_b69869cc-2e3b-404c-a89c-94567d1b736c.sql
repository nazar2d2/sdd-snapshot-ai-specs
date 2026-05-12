-- Drop existing policies if they exist (using DO block for conditional drops)
DO $$
BEGIN
  -- Drop whitelisted_users policies if they exist
  DROP POLICY IF EXISTS "Service role can manage whitelist" ON public.whitelisted_users;
  DROP POLICY IF EXISTS "Authenticated users can check whitelist" ON public.whitelisted_users;
END $$;

-- Create policies for whitelisted_users table
CREATE POLICY "Service role can manage whitelist" ON public.whitelisted_users
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can check whitelist" ON public.whitelisted_users
FOR SELECT TO authenticated USING (true);

-- Update get_user_profile function to return very high credits for whitelisted users
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  user_email TEXT;
  is_whitelisted_flag BOOLEAN;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;
  
  -- Check if whitelisted
  SELECT EXISTS (
    SELECT 1 FROM public.whitelisted_users WHERE LOWER(email) = LOWER(user_email)
  ) INTO is_whitelisted_flag;
  
  -- Get profile data with whitelist flag
  -- For whitelisted users, return 999999999 credits to represent unlimited
  SELECT json_build_object(
    'credits', CASE WHEN is_whitelisted_flag THEN 999999999 ELSE COALESCE(p.credits, 0) END,
    'subscription_tier', COALESCE(p.subscription_tier, 'none'),
    'stripe_customer_id', p.stripe_customer_id,
    'subscription_status', p.subscription_status,
    'current_period_end', p.current_period_end,
    'is_whitelisted', is_whitelisted_flag
  ) INTO result
  FROM public.profiles p
  WHERE p.id = user_id;
  
  -- If no profile exists, return defaults with whitelist flag
  IF result IS NULL THEN
    result := json_build_object(
      'credits', CASE WHEN is_whitelisted_flag THEN 999999999 ELSE 0 END,
      'subscription_tier', 'none',
      'stripe_customer_id', NULL,
      'subscription_status', NULL,
      'current_period_end', NULL,
      'is_whitelisted', is_whitelisted_flag
    );
  END IF;
  
  RETURN result;
END;
$$;