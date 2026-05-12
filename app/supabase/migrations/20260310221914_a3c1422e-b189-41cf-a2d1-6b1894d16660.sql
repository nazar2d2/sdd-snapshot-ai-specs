CREATE POLICY "Users can delete tasks of their own jobs"
ON public.generation_tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM generation_jobs
    WHERE generation_jobs.id = generation_tasks.job_id
      AND generation_jobs.user_id = auth.uid()
  )
);