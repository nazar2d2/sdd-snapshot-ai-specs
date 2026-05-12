-- Fix get_admin_profiles to properly order results inside the aggregate
CREATE OR REPLACE FUNCTION public.get_admin_profiles(limit_count integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  users_list JSON;
BEGIN
  -- Security Guard
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Administrator can perform this action.';
  END IF;

  -- Join auth.users and profiles to get email + credits
  -- Use subquery with ORDER BY and LIMIT, then aggregate
  SELECT json_agg(row_data) INTO users_list
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'email', u.email,
      'credits', COALESCE(p.credits, 0),
      'is_unlimited', COALESCE(p.is_unlimited, false),
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