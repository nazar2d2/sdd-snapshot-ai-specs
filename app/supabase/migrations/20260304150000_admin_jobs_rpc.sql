-- Admin RPC: List generation jobs with user emails (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_admin_jobs(
  p_status TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT COALESCE(json_agg(row_data), '[]'::json) INTO result
  FROM (
    SELECT json_build_object(
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
    FROM generation_jobs j
    JOIN auth.users u ON u.id = j.user_id
    WHERE
      (p_status IS NULL OR j.status = p_status)
      AND (p_email IS NULL OR LOWER(u.email) LIKE '%' || LOWER(p_email) || '%')
    ORDER BY j.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN result;
END;
$$;

-- Admin RPC: Get tasks for a specific job
CREATE OR REPLACE FUNCTION public.get_admin_job_tasks(p_job_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT COALESCE(json_agg(row_data), '[]'::json) INTO result
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'view_name', t.view_name,
      'variant_name', t.variant_name,
      'variant_color', t.variant_color,
      'status', t.status,
      'attempt_count', t.attempt_count,
      'max_attempts', t.max_attempts,
      'last_error', t.last_error,
      'result_url', t.result_url,
      'is_base', t.is_base,
      'created_at', t.created_at
    ) AS row_data
    FROM generation_tasks t
    WHERE t.job_id = p_job_id
    ORDER BY t.is_base DESC, t.view_name, t.variant_name
  ) sub;

  RETURN result;
END;
$$;

-- Admin RPC: Cancel a stuck/running job
CREATE OR REPLACE FUNCTION public.admin_cancel_job(p_job_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  UPDATE generation_jobs
  SET status = 'failed', completed_at = now(), updated_at = now()
  WHERE id = p_job_id AND status IN ('pending', 'running');

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Job not found or already completed');
  END IF;

  UPDATE generation_tasks
  SET status = 'failed', updated_at = now()
  WHERE job_id = p_job_id AND status IN ('pending', 'running');

  RETURN json_build_object('success', true, 'message', 'Job cancelled');
END;
$$;
