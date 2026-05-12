UPDATE generation_tasks
SET status = 'pending', attempt_count = 0, updated_at = now()
WHERE status = 'running' AND updated_at < now() - interval '3 minutes';

UPDATE generation_jobs
SET updated_at = now()
WHERE id IN (
  SELECT DISTINCT job_id FROM generation_tasks
  WHERE status = 'pending' AND updated_at >= now() - interval '1 minute'
);