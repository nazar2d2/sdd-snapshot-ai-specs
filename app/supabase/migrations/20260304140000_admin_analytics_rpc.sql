-- Rich analytics RPC for the admin dashboard charts & filters
CREATE OR REPLACE FUNCTION public.get_admin_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  cutoff TIMESTAMPTZ := now() - (p_days || ' days')::interval;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT json_build_object(
    -- Summary counts (all-time)
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_jobs', (SELECT COUNT(*) FROM generation_jobs),
    'total_credits', (SELECT COALESCE(SUM(credits), 0) FROM profiles),

    -- Period-filtered counts
    'period_new_users', (SELECT COUNT(*) FROM auth.users WHERE created_at >= cutoff),
    'period_jobs', (SELECT COUNT(*) FROM generation_jobs WHERE created_at >= cutoff),
    'period_jobs_done', (SELECT COUNT(*) FROM generation_jobs WHERE created_at >= cutoff AND status = 'done'),
    'period_jobs_failed', (SELECT COUNT(*) FROM generation_jobs WHERE created_at >= cutoff AND status = 'failed'),
    'period_jobs_running', (SELECT COUNT(*) FROM generation_jobs WHERE status IN ('pending', 'running')),

    -- Daily signups (for area chart)
    'daily_signups', (
      SELECT COALESCE(json_agg(row_data ORDER BY day), '[]'::json)
      FROM (
        SELECT json_build_object('day', d.day::date, 'count', COALESCE(c.cnt, 0)) AS row_data
        FROM generate_series(cutoff::date, now()::date, '1 day') AS d(day)
        LEFT JOIN (
          SELECT created_at::date AS day, COUNT(*) AS cnt
          FROM auth.users
          WHERE created_at >= cutoff
          GROUP BY created_at::date
        ) c ON c.day = d.day::date
      ) sub
    ),

    -- Daily generations (for bar chart)
    'daily_jobs', (
      SELECT COALESCE(json_agg(row_data ORDER BY day), '[]'::json)
      FROM (
        SELECT json_build_object(
          'day', d.day::date,
          'total', COALESCE(t.total, 0),
          'done', COALESCE(t.done, 0),
          'failed', COALESCE(t.failed, 0)
        ) AS row_data
        FROM generate_series(cutoff::date, now()::date, '1 day') AS d(day)
        LEFT JOIN (
          SELECT
            created_at::date AS day,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'done') AS done,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed
          FROM generation_jobs
          WHERE created_at >= cutoff
          GROUP BY created_at::date
        ) t ON t.day = d.day::date
      ) sub
    ),

    -- Job status breakdown (for pie chart)
    'job_status_breakdown', (
      SELECT COALESCE(json_agg(json_build_object('status', status, 'count', cnt)), '[]'::json)
      FROM (
        SELECT status, COUNT(*) AS cnt
        FROM generation_jobs
        WHERE created_at >= cutoff
        GROUP BY status
        ORDER BY cnt DESC
      ) sub
    ),

    -- Top 10 users by jobs run in period
    'top_users_by_jobs', (
      SELECT COALESCE(json_agg(row_data), '[]'::json)
      FROM (
        SELECT json_build_object(
          'email', u.email,
          'jobs', COUNT(j.id),
          'credits', COALESCE(p.credits, 0)
        ) AS row_data
        FROM generation_jobs j
        JOIN auth.users u ON u.id = j.user_id
        LEFT JOIN profiles p ON p.id = j.user_id
        WHERE j.created_at >= cutoff
        GROUP BY u.email, p.credits
        ORDER BY COUNT(j.id) DESC
        LIMIT 10
      ) sub
    ),

    -- Credit distribution buckets (for histogram)
    'credit_distribution', (
      SELECT COALESCE(json_agg(row_data ORDER BY bucket_order), '[]'::json)
      FROM (
        SELECT json_build_object('bucket', bucket, 'count', cnt) AS row_data, bucket_order
        FROM (
          SELECT
            CASE
              WHEN credits = 0 THEN '0'
              WHEN credits BETWEEN 1 AND 100 THEN '1-100'
              WHEN credits BETWEEN 101 AND 1000 THEN '101-1K'
              WHEN credits BETWEEN 1001 AND 10000 THEN '1K-10K'
              WHEN credits BETWEEN 10001 AND 100000 THEN '10K-100K'
              ELSE '100K+'
            END AS bucket,
            CASE
              WHEN credits = 0 THEN 0
              WHEN credits BETWEEN 1 AND 100 THEN 1
              WHEN credits BETWEEN 101 AND 1000 THEN 2
              WHEN credits BETWEEN 1001 AND 10000 THEN 3
              WHEN credits BETWEEN 10001 AND 100000 THEN 4
              ELSE 5
            END AS bucket_order,
            COUNT(*) AS cnt
          FROM profiles
          GROUP BY bucket, bucket_order
        ) sub2
      ) sub
    ),

    -- Success rate
    'success_rate', (
      SELECT CASE
        WHEN COUNT(*) = 0 THEN 100.0
        ELSE ROUND(COUNT(*) FILTER (WHERE status = 'done')::numeric / COUNT(*)::numeric * 100, 1)
      END
      FROM generation_jobs
      WHERE created_at >= cutoff AND status IN ('done', 'failed')
    ),

    -- Average tasks per job
    'avg_tasks_per_job', (
      SELECT COALESCE(ROUND(AVG(tasks_total)::numeric, 1), 0)
      FROM generation_jobs
      WHERE created_at >= cutoff
    )
  ) INTO result;

  RETURN result;
END;
$$;
