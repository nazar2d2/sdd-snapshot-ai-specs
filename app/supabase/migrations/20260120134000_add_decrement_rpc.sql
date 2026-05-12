-- RPC to safely decrement credits
CREATE OR REPLACE FUNCTION public.decrement_credits(user_id UUID, amount INTEGER DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT credits INTO current_credits FROM public.profiles WHERE id = user_id FOR UPDATE;
  
  IF current_credits >= amount THEN
    UPDATE public.profiles SET credits = credits - amount WHERE id = user_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;
