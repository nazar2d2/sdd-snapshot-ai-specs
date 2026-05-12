-- Create is_admin function (uses user_roles table with fallback to hardcoded email)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_email TEXT;
BEGIN
  -- Check user_roles table first
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback: Check hardcoded admin email
  current_email := auth.jwt() ->> 'email';
  IF LOWER(current_email) = 'snapshot@gmail.com' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Create give_admin_credits function
CREATE OR REPLACE FUNCTION public.give_admin_credits(target_email TEXT, amount INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  current_credits INTEGER;
  new_credits INTEGER;
BEGIN
  -- Security Guard
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Administrator can perform this action.';
  END IF;

  -- Find user ID by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(target_email);

  IF target_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'User not found');
  END IF;

  -- Update credits (with upsert in case profile missing)
  INSERT INTO public.profiles (id, credits)
  VALUES (target_user_id, amount)
  ON CONFLICT (id) DO UPDATE
  SET credits = profiles.credits + amount
  RETURNING credits INTO new_credits;

  RETURN json_build_object(
    'success', true, 
    'message', 'Credits added successfully', 
    'new_balance', new_credits
  );
END;
$$;

-- Create get_admin_stats function
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_users INTEGER;
  total_jobs INTEGER;
  total_credits_distributed BIGINT;
BEGIN
  -- Security Guard
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Administrator can perform this action.';
  END IF;

  SELECT COUNT(*) INTO total_users FROM auth.users;
  SELECT COUNT(*) INTO total_jobs FROM public.generation_jobs;
  SELECT SUM(credits) INTO total_credits_distributed FROM public.profiles;

  RETURN json_build_object(
    'total_users', total_users,
    'total_jobs', total_jobs,
    'total_credits_distributed', COALESCE(total_credits_distributed, 0)
  );
END;
$$;

-- Create get_admin_profiles function
CREATE OR REPLACE FUNCTION public.get_admin_profiles(limit_count INTEGER DEFAULT 50)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  users_list JSON;
BEGIN
  -- Security Guard
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Administrator can perform this action.';
  END IF;

  -- Join auth.users and profiles to get email + credits
  SELECT json_agg(
    json_build_object(
      'id', u.id,
      'email', u.email,
      'credits', COALESCE(p.credits, 0),
      'created_at', u.created_at
    )
  ) INTO users_list
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  ORDER BY u.created_at DESC
  LIMIT limit_count;

  RETURN COALESCE(users_list, '[]'::json);
END;
$$;

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');