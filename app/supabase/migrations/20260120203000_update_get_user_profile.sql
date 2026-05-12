-- Update get_user_profile function to properly return is_unlimited flag from profiles table
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Get profile data including is_unlimited flag
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
  
  -- If no profile exists, return defaults
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
