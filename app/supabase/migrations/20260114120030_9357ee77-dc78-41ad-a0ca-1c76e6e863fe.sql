-- Add INSERT policy to generation_tasks table
-- This restricts task creation to the service role only (edge functions)
-- Prevents any authenticated user from inserting tasks into other users' jobs

CREATE POLICY "Only service role can insert tasks"
  ON public.generation_tasks
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');