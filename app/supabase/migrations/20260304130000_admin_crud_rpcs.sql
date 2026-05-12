-- Admin CRUD RPCs for user management

-- 1. Expand get_admin_profiles to return full profile data
CREATE OR REPLACE FUNCTION public.get_admin_profiles(limit_count integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  users_list JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Administrator can perform this action.';
  END IF;

  SELECT json_agg(row_data) INTO users_list
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'email', u.email,
      'credits', COALESCE(p.credits, 0),
      'is_unlimited', COALESCE(p.is_unlimited, false),
      'full_name', p.full_name,
      'subscription_tier', COALESCE(p.subscription_tier, 'none'),
      'subscription_status', p.subscription_status,
      'created_at', u.created_at
    ) AS row_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    ORDER BY u.created_at DESC
    LIMIT limit_count
  ) sub;

  RETURN COALESCE(users_list, '[]'::json);
END;
$function$;

-- 2. Set credits to an exact value (not additive)
CREATE OR REPLACE FUNCTION public.admin_set_credits(target_user_id UUID, new_credits INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  IF new_credits < 0 THEN
    RETURN json_build_object('success', false, 'message', 'Credits cannot be negative');
  END IF;

  UPDATE public.profiles
  SET credits = new_credits, updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'User profile not found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Credits updated', 'new_balance', new_credits);
END;
$$;

-- 3. Update user profile fields (is_unlimited, full_name, subscription_tier)
CREATE OR REPLACE FUNCTION public.admin_update_user(
  target_user_id UUID,
  p_is_unlimited BOOLEAN DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_subscription_tier TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  UPDATE public.profiles
  SET
    is_unlimited = COALESCE(p_is_unlimited, is_unlimited),
    full_name = CASE
      WHEN p_full_name IS NULL THEN full_name
      WHEN p_full_name = '' THEN NULL
      ELSE p_full_name
    END,
    subscription_tier = COALESCE(p_subscription_tier, subscription_tier),
    updated_at = now()
  WHERE id = target_user_id
  RETURNING * INTO updated_row;

  IF updated_row IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'User profile not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'User updated',
    'user', json_build_object(
      'id', updated_row.id,
      'credits', updated_row.credits,
      'is_unlimited', updated_row.is_unlimited,
      'full_name', updated_row.full_name,
      'subscription_tier', updated_row.subscription_tier
    )
  );
END;
$$;

-- 4. Delete user entirely (cascades from auth.users to profiles)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;

  IF target_email IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'User not found');
  END IF;

  -- Prevent deleting the admin account
  IF LOWER(target_email) = 'snapshot@gmail.com' THEN
    RETURN json_build_object('success', false, 'message', 'Cannot delete the admin account');
  END IF;

  -- Remove from whitelist if present (not FK-linked, keyed by email)
  DELETE FROM public.whitelisted_users WHERE LOWER(email) = LOWER(target_email);

  -- Delete from auth.users (cascades to profiles, generation_jobs, etc.)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'User deleted: ' || target_email);
END;
$$;
