-- Paginated admin list RPCs: p_limit, p_offset, total_count in JSON response.

CREATE OR REPLACE FUNCTION public.get_admin_profiles(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_rows json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Administrator can perform this action.';
  END IF;

  SELECT count(*) INTO v_total
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id;

  SELECT coalesce(json_agg(row_data ORDER BY created_at DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT u.created_at,
           json_build_object(
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
    LIMIT p_limit
    OFFSET p_offset
  ) page;

  RETURN json_build_object(
    'rows', v_rows,
    'total_count', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_jobs(
  p_status text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_rows json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.generation_jobs j
  JOIN auth.users u ON u.id = j.user_id
  WHERE (p_status IS NULL OR j.status = p_status)
    AND (p_email IS NULL OR lower(u.email) LIKE '%' || lower(p_email) || '%');

  SELECT coalesce(json_agg(row_data ORDER BY created_at DESC), '[]'::json) INTO v_rows
  FROM (
    SELECT j.created_at,
           json_build_object(
             'id', j.id,
             'user_id', j.user_id,
             'email', u.email,
             'status', j.status,
             'niche', j.niche,
             'tasks_total', j.tasks_total,
             'tasks_done', j.tasks_done,
             'tasks_failed', j.tasks_failed,
             'provider_id', j.provider_id,
             'created_at', j.created_at,
             'completed_at', j.completed_at,
             'config', j.config
           ) AS row_data
    FROM public.generation_jobs j
    JOIN auth.users u ON u.id = j.user_id
    WHERE (p_status IS NULL OR j.status = p_status)
      AND (p_email IS NULL OR lower(u.email) LIKE '%' || lower(p_email) || '%')
    ORDER BY j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) page;

  RETURN json_build_object(
    'rows', v_rows,
    'total_count', v_total
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
