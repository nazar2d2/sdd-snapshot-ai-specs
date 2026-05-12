
-- 1. Create system_prompts table
CREATE TABLE IF NOT EXISTS public.system_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  prompt_text text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

-- Admin can do everything on system_prompts
CREATE POLICY "Admins can manage system_prompts" ON public.system_prompts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public can read system_prompts
CREATE POLICY "Anyone can read system_prompts" ON public.system_prompts
  FOR SELECT TO anon, authenticated
  USING (true);

-- 2. get_system_prompt RPC
CREATE OR REPLACE FUNCTION public.get_system_prompt(p_key text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT prompt_text FROM public.system_prompts WHERE key = p_key LIMIT 1);
END;
$$;

-- 3. get_admin_analytics RPC
CREATE OR REPLACE FUNCTION public.get_admin_analytics(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  v_total_users integer;
  v_total_jobs integer;
  v_total_credits bigint;
  v_period_new_users integer;
  v_period_jobs integer;
  v_period_jobs_done integer;
  v_period_jobs_failed integer;
  v_period_jobs_running integer;
  v_daily_signups json;
  v_daily_jobs json;
  v_job_status_breakdown json;
  v_top_users json;
  v_credit_distribution json;
  v_success_rate numeric;
  v_avg_tasks numeric;
  v_cutoff timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  v_cutoff := now() - (p_days || ' days')::interval;

  SELECT count(*) INTO v_total_users FROM auth.users;
  SELECT count(*) INTO v_total_jobs FROM public.generation_jobs;
  SELECT coalesce(sum(credits), 0) INTO v_total_credits FROM public.profiles;

  SELECT count(*) INTO v_period_new_users FROM auth.users WHERE created_at >= v_cutoff;
  SELECT count(*) INTO v_period_jobs FROM public.generation_jobs WHERE created_at >= v_cutoff;
  SELECT count(*) INTO v_period_jobs_done FROM public.generation_jobs WHERE created_at >= v_cutoff AND status = 'done';
  SELECT count(*) INTO v_period_jobs_failed FROM public.generation_jobs WHERE created_at >= v_cutoff AND status = 'failed';
  SELECT count(*) INTO v_period_jobs_running FROM public.generation_jobs WHERE created_at >= v_cutoff AND status = 'running';

  SELECT coalesce(json_agg(r), '[]'::json) INTO v_daily_signups
  FROM (
    SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day, count(*)::int AS count
    FROM auth.users WHERE created_at >= v_cutoff
    GROUP BY created_at::date ORDER BY created_at::date
  ) r;

  SELECT coalesce(json_agg(r), '[]'::json) INTO v_daily_jobs
  FROM (
    SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day,
           count(*)::int AS total,
           count(*) FILTER (WHERE status = 'done')::int AS done,
           count(*) FILTER (WHERE status = 'failed')::int AS failed
    FROM public.generation_jobs WHERE created_at >= v_cutoff
    GROUP BY created_at::date ORDER BY created_at::date
  ) r;

  SELECT coalesce(json_agg(r), '[]'::json) INTO v_job_status_breakdown
  FROM (
    SELECT status, count(*)::int AS count
    FROM public.generation_jobs WHERE created_at >= v_cutoff
    GROUP BY status ORDER BY count DESC
  ) r;

  SELECT coalesce(json_agg(r), '[]'::json) INTO v_top_users
  FROM (
    SELECT u.email, count(j.id)::int AS jobs, coalesce(p.credits, 0) AS credits
    FROM public.generation_jobs j
    JOIN auth.users u ON u.id = j.user_id
    LEFT JOIN public.profiles p ON p.id = j.user_id
    WHERE j.created_at >= v_cutoff
    GROUP BY u.email, p.credits
    ORDER BY jobs DESC LIMIT 10
  ) r;

  SELECT coalesce(json_agg(r), '[]'::json) INTO v_credit_distribution
  FROM (
    SELECT
      CASE
        WHEN credits = 0 THEN '0'
        WHEN credits BETWEEN 1 AND 100 THEN '1-100'
        WHEN credits BETWEEN 101 AND 1000 THEN '101-1K'
        WHEN credits BETWEEN 1001 AND 10000 THEN '1K-10K'
        ELSE '10K+'
      END AS bucket,
      count(*)::int AS count
    FROM public.profiles
    GROUP BY bucket ORDER BY min(credits)
  ) r;

  SELECT CASE WHEN v_period_jobs > 0 THEN round(v_period_jobs_done::numeric / v_period_jobs * 100, 1) ELSE 0 END INTO v_success_rate;
  SELECT CASE WHEN v_period_jobs > 0 THEN round(coalesce(avg(tasks_total), 0)::numeric, 1) ELSE 0 END INTO v_avg_tasks
  FROM public.generation_jobs WHERE created_at >= v_cutoff;

  result := json_build_object(
    'total_users', v_total_users,
    'total_jobs', v_total_jobs,
    'total_credits', v_total_credits,
    'period_new_users', v_period_new_users,
    'period_jobs', v_period_jobs,
    'period_jobs_done', v_period_jobs_done,
    'period_jobs_failed', v_period_jobs_failed,
    'period_jobs_running', v_period_jobs_running,
    'daily_signups', v_daily_signups,
    'daily_jobs', v_daily_jobs,
    'job_status_breakdown', v_job_status_breakdown,
    'top_users_by_jobs', v_top_users,
    'credit_distribution', v_credit_distribution,
    'success_rate', v_success_rate,
    'avg_tasks_per_job', v_avg_tasks
  );

  RETURN result;
END;
$$;

-- 4. get_admin_jobs RPC
CREATE OR REPLACE FUNCTION public.get_admin_jobs(
  p_status text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT coalesce(json_agg(r), '[]'::json) INTO result
  FROM (
    SELECT j.id, j.user_id, u.email, j.status, j.niche,
           j.tasks_total, j.tasks_done, j.tasks_failed,
           j.provider_id, j.created_at, j.completed_at, j.config
    FROM public.generation_jobs j
    JOIN auth.users u ON u.id = j.user_id
    WHERE (p_status IS NULL OR j.status = p_status)
      AND (p_email IS NULL OR lower(u.email) LIKE '%' || lower(p_email) || '%')
    ORDER BY j.created_at DESC
    LIMIT p_limit
  ) r;

  RETURN result;
END;
$$;

-- 5. get_admin_job_tasks RPC
CREATE OR REPLACE FUNCTION public.get_admin_job_tasks(p_job_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT coalesce(json_agg(r), '[]'::json) INTO result
  FROM (
    SELECT id, job_id, view_key, view_name, variant_key, variant_name,
           variant_color, status, result_url, last_error,
           attempt_count, max_attempts, is_base, created_at, updated_at
    FROM public.generation_tasks
    WHERE job_id = p_job_id
    ORDER BY is_base DESC, view_key, variant_key
  ) r;

  RETURN result;
END;
$$;

-- 6. admin_cancel_job RPC
CREATE OR REPLACE FUNCTION public.admin_cancel_job(p_job_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT status INTO v_status FROM public.generation_jobs WHERE id = p_job_id;
  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Job not found');
  END IF;
  IF v_status IN ('done', 'failed') THEN
    RETURN json_build_object('success', false, 'message', 'Job already finished');
  END IF;

  UPDATE public.generation_jobs SET status = 'failed', completed_at = now(), updated_at = now() WHERE id = p_job_id;
  UPDATE public.generation_tasks SET status = 'failed', updated_at = now() WHERE job_id = p_job_id AND status IN ('pending', 'running');

  RETURN json_build_object('success', true, 'message', 'Job cancelled');
END;
$$;

-- 7. Update get_admin_profiles to include more fields
CREATE OR REPLACE FUNCTION public.get_admin_profiles(limit_count integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 8. Add RLS policy for admin to read all whitelisted_users
CREATE POLICY "Admins can read all whitelist entries" ON public.whitelisted_users
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
