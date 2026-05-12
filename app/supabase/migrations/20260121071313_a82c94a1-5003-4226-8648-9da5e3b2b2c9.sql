-- Fix decrement_credits to properly handle is_unlimited users
-- and to work with service_role correctly
CREATE OR REPLACE FUNCTION public.decrement_credits(user_id uuid, amount integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_credits INTEGER;
  unlimited_flag BOOLEAN;
BEGIN
  -- Ensure row exists first
  INSERT INTO public.profiles (id, credits)
  VALUES (user_id, 0)
  ON CONFLICT (id) DO NOTHING;

  -- Get current credits and unlimited flag
  SELECT credits, is_unlimited INTO current_credits, unlimited_flag
  FROM public.profiles
  WHERE id = user_id;

  -- If user is unlimited, always succeed without deducting
  IF COALESCE(unlimited_flag, false) THEN
    RETURN true;
  END IF;

  -- Check if user has enough credits
  IF COALESCE(current_credits, 0) < amount THEN
    RETURN false;
  END IF;

  -- Deduct credits
  UPDATE public.profiles
  SET credits = credits - amount
  WHERE id = user_id;

  RETURN true;
END;
$function$;