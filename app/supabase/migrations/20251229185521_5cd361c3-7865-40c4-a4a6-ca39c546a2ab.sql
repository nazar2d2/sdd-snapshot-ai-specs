-- Add product_hash column to generation_jobs for product identity verification
ALTER TABLE public.generation_jobs 
ADD COLUMN IF NOT EXISTS product_hash TEXT;

-- Add product_hash column to generation_tasks for task-level verification  
ALTER TABLE public.generation_tasks
ADD COLUMN IF NOT EXISTS product_hash TEXT;

-- Add index for faster lookups by job_id + product_hash
CREATE INDEX IF NOT EXISTS idx_tasks_job_product 
ON public.generation_tasks(job_id, product_hash);

-- Add index on generation_jobs for product_hash
CREATE INDEX IF NOT EXISTS idx_jobs_product_hash
ON public.generation_jobs(product_hash);