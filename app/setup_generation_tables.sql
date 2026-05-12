/* 
  SETUP GENERATION TABLES (Definitive Fix)
  Run this script in your Supabase SQL Editor to fix the "Table not found" error.
  It creates the missing generation_jobs and generation_tasks tables with all necessary columns.
*/

-- 1. Create generation_jobs table (with all columns)
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  niche TEXT NOT NULL,
  tasks_total INTEGER NOT NULL DEFAULT 0,
  tasks_done INTEGER NOT NULL DEFAULT 0,
  tasks_failed INTEGER NOT NULL DEFAULT 0,
  provider_id TEXT NOT NULL DEFAULT 'google/gemini-2.0-flash-001',
  anchor_url TEXT,
  model_lock JSONB,
  job_seed TEXT,
  config JSONB,
  -- Columns from later migrations
  product_hash TEXT,
  aspect_ratio TEXT DEFAULT '1:1',
  target_width INTEGER DEFAULT 1024,
  target_height INTEGER DEFAULT 1024,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 2. Create generation_tasks table (with all columns)
CREATE TABLE IF NOT EXISTS public.generation_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  view_key TEXT NOT NULL,
  view_name TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  variant_color TEXT,
  is_base BOOLEAN NOT NULL DEFAULT false,
  task_seed TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 12,
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_error TEXT,
  result_url TEXT,
  -- Columns from later migrations
  product_hash TEXT,
  aspect_ratio TEXT DEFAULT '1:1',
  target_width INTEGER DEFAULT 1024,
  target_height INTEGER DEFAULT 1024,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON public.generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_product_hash ON public.generation_jobs(product_hash);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_aspect_ratio ON public.generation_jobs(aspect_ratio);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_job_id ON public.generation_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_status ON public.generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_next_run ON public.generation_tasks(next_run_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_tasks_job_product ON public.generation_tasks(job_id, product_hash);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_aspect_ratio ON public.generation_tasks(aspect_ratio);

-- 4. Enable RLS
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_tasks ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for generation_jobs
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.generation_jobs;
CREATE POLICY "Users can view their own jobs"
  ON public.generation_jobs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own jobs" ON public.generation_jobs;
CREATE POLICY "Users can create their own jobs"
  ON public.generation_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own jobs" ON public.generation_jobs;
CREATE POLICY "Users can update their own jobs"
  ON public.generation_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. RLS policies for generation_tasks (through job ownership)
DROP POLICY IF EXISTS "Users can view tasks of their own jobs" ON public.generation_tasks;
CREATE POLICY "Users can view tasks of their own jobs"
  ON public.generation_tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.generation_jobs 
    WHERE generation_jobs.id = generation_tasks.job_id 
    AND generation_jobs.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update tasks of their own jobs" ON public.generation_tasks;
CREATE POLICY "Users can update tasks of their own jobs"
  ON public.generation_tasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.generation_jobs 
    WHERE generation_jobs.id = generation_tasks.job_id 
    AND generation_jobs.user_id = auth.uid()
  ));

-- 7. Triggers for updated_at (Requires update_updated_at_column from setup_database_full.sql)
-- If update_updated_at_column does not exist, create it:
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_generation_jobs_updated_at ON public.generation_jobs;
CREATE TRIGGER update_generation_jobs_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_generation_tasks_updated_at ON public.generation_tasks;
CREATE TRIGGER update_generation_tasks_updated_at
  BEFORE UPDATE ON public.generation_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_tasks;
