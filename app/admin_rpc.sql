/*
  ADMIN DASHBOARD BACKEND
  Run this script in Supabase SQL Editor to enable Admin capabilities.
*/

-- 1. Helper function to verify Admin status (user_roles: role = admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.has_role(auth.uid(), 'admin');
END;
$$;

-- 2. RPC: Give Admin Credits
-- Allows the admin to give arbitrary credits to any user by email.
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

-- 3. RPC: Get Admin Stats
-- Returns high-level database statistics for the dashboard.
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 4. RPC: Get Admin Profiles (List users for management)
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

