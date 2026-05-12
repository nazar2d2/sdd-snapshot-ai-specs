-- First delete duplicates properly by using CTE with row numbers
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY job_id, view_key, variant_key ORDER BY created_at DESC) as rn
  FROM public.generation_tasks
)
DELETE FROM public.generation_tasks 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Now create the unique index
CREATE UNIQUE INDEX idx_generation_tasks_job_view_variant 
ON public.generation_tasks (job_id, view_key, variant_key);