-- Add aspect ratio and target dimensions to generation_jobs table
ALTER TABLE public.generation_jobs 
ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT '1:1',
ADD COLUMN IF NOT EXISTS target_width integer DEFAULT 1024,
ADD COLUMN IF NOT EXISTS target_height integer DEFAULT 1024;

-- Add aspect ratio and target dimensions to generation_tasks table
ALTER TABLE public.generation_tasks 
ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT '1:1',
ADD COLUMN IF NOT EXISTS target_width integer DEFAULT 1024,
ADD COLUMN IF NOT EXISTS target_height integer DEFAULT 1024;

-- Create index for efficient filtering by aspect ratio
CREATE INDEX IF NOT EXISTS idx_generation_jobs_aspect_ratio ON public.generation_jobs(aspect_ratio);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_aspect_ratio ON public.generation_tasks(aspect_ratio);