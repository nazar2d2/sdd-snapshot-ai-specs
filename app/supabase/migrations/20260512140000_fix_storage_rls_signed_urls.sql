-- Fix storage RLS so authenticated users can create signed URLs for their own job images.
-- The cross-schema EXISTS check (storage → public.generation_jobs) sometimes fails
-- in security-restricted contexts. Use a SECURITY DEFINER helper to bypass this. == 
CREATE OR REPLACE FUNCTION public.user_owns_job(job_id_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.generation_jobs
    WHERE id::text = job_id_text
      AND user_id = auth.uid()
  );
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.user_owns_job(text) TO authenticated;

-- Drop and recreate the storage SELECT policy using the helper
DROP POLICY IF EXISTS "Users can view their own generated images" ON storage.objects;

CREATE POLICY "Users can view their own generated images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'generated-images'
    AND (
      -- User folder pattern: {userId}/...
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      -- Temp files: {userId}/tmp/...
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      -- Job folder pattern: jobs/{jobId}/...
      (
        (storage.foldername(name))[1] = 'jobs'
        AND public.user_owns_job((storage.foldername(name))[2])
      )
    )
  );

NOTIFY pgrst, 'reload schema';
