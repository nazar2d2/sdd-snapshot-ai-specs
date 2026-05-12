UPDATE generation_tasks
SET status = 'pending', attempt_count = 0, last_error = 'Reset: fix home decor resolution bug', updated_at = now()
WHERE status = 'running' AND result_url IS NULL AND updated_at < now() - interval '5 minutes'
AND job_id IN (SELECT id FROM generation_jobs WHERE niche = 'homeDecor' AND status = 'running');

UPDATE generation_jobs
SET updated_at = now()
WHERE niche = 'homeDecor' AND status = 'running'
AND updated_at < now() - interval '5 minutes';