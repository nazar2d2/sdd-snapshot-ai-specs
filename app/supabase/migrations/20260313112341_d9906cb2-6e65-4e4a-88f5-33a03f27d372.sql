ALTER TABLE public.generation_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.generation_tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_generation_tasks_parent ON public.generation_tasks(parent_task_id);