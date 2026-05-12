
-- admin_set_credits RPC
CREATE OR REPLACE FUNCTION public.admin_set_credits(target_user_id uuid, new_credits integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  UPDATE public.profiles SET credits = new_credits, updated_at = now() WHERE id = target_user_id
  RETURNING credits INTO v_new;

  IF v_new IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'User profile not found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Credits updated', 'new_balance', v_new);
END;
$$;

-- admin_update_user RPC
CREATE OR REPLACE FUNCTION public.admin_update_user(
  target_user_id uuid,
  p_is_unlimited boolean DEFAULT false,
  p_full_name text DEFAULT NULL,
  p_subscription_tier text DEFAULT 'none'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  UPDATE public.profiles
  SET is_unlimited = p_is_unlimited,
      full_name = p_full_name,
      subscription_tier = COALESCE(p_subscription_tier, 'none'),
      updated_at = now()
  WHERE id = target_user_id
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'User not found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'User updated', 'user', json_build_object(
    'is_unlimited', v_row.is_unlimited,
    'full_name', v_row.full_name,
    'subscription_tier', v_row.subscription_tier
  ));
END;
$$;

-- admin_delete_user RPC
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = target_user_id;
  IF v_email IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'User not found');
  END IF;

  -- Delete profile, whitelist entry, then auth user
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM public.whitelisted_users WHERE lower(email) = lower(v_email);
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'User ' || v_email || ' deleted (profile removed). Note: auth user must be deleted via admin API.');
END;
$$;

NOTIFY pgrst, 'reload schema';
