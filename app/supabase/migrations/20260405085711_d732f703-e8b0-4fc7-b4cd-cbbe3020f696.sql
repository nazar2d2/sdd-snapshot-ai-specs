UPDATE generation_tasks
SET status = 'pending', attempt_count = 0, last_error = 'Reset for home decor worker migration', updated_at = now()
WHERE status = 'running' AND updated_at < now() - interval '2 minutes'
AND job_id IN (SELECT id FROM generation_jobs WHERE niche = 'homeDecor');

UPDATE generation_jobs
SET status = 'running', updated_at = now()
WHERE niche = 'homeDecor' AND status IN ('pending', 'running')
AND updated_at < now() - interval '2 minutes';