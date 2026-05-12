-- Create RPC function to get user profile with whitelist check
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID)
RETURNS JSON
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
  SELECT json_build_object(
    'credits', COALESCE(p.credits, 0),
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
      'credits', 0,
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