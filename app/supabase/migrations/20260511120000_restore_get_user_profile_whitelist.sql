-- Restore get_user_profile contract: whitelist OR profiles.is_unlimited, is_whitelisted in JSON.
-- Earlier migration 20260120203000_update_get_user_profile.sql overwrote this logic; re-apply canonical behavior.

CREATE OR REPLACE FUNCTION public.get_user_profile(user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result JSON;
  user_email TEXT;
  is_whitelisted_flag BOOLEAN;
  unlimited_flag BOOLEAN;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.whitelisted_users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(user_email))
  ) INTO is_whitelisted_flag;

  SELECT COALESCE(p.is_unlimited, false)
  INTO unlimited_flag
  FROM public.profiles p
  WHERE p.id = user_id;

  unlimited_flag := (COALESCE(is_whitelisted_flag, false) OR COALESCE(unlimited_flag, false));

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
