CREATE OR REPLACE FUNCTION public.increment_credits(user_id uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET credits = credits + amount
  WHERE id = user_id AND NOT COALESCE(is_unlimited, false);
END;
$$;