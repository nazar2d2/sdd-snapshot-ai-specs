
-- Create the reap_stale_jobs RPC
CREATE OR REPLACE FUNCTION public.reap_stale_jobs(max_age_minutes int DEFAULT 60)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reaped_jobs int;
  reaped_tasks int;
  stale_job_ids uuid[];
BEGIN
  -- Only admins or service role can call this
  IF NOT (public.is_admin() OR (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role') THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  -- Collect stale job IDs
  SELECT array_agg(id) INTO stale_job_ids
  FROM public.generation_jobs
  WHERE status IN ('pending', 'running')
    AND updated_at < now() - (max_age_minutes || ' minutes')::interval;

  -- If nothing to reap, return early
  IF stale_job_ids IS NULL OR array_length(stale_job_ids, 1) IS NULL THEN
    RETURN json_build_object('reaped_jobs', 0, 'reaped_tasks', 0);
  END IF;

  -- Mark stale jobs as failed
  UPDATE public.generation_jobs
  SET status = 'failed', completed_at = now(), updated_at = now()
  WHERE id = ANY(stale_job_ids);

  reaped_jobs := array_length(stale_job_ids, 1);

  -- Mark their orphaned tasks as failed
  WITH orphaned AS (
    UPDATE public.generation_tasks
    SET status = 'failed',
        last_error = 'Auto-reaped: exceeded ' || max_age_minutes || '-minute timeout',
        updated_at = now()
    WHERE status IN ('pending', 'running')
      AND job_id = ANY(stale_job_ids)
    RETURNING id
  )
  SELECT count(*) INTO reaped_tasks FROM orphaned;

  RETURN json_build_object('reaped_jobs', reaped_jobs, 'reaped_tasks', reaped_tasks);
END;
$$;
