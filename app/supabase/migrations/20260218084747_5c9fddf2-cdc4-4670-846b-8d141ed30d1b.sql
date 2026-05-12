
-- =====================================================
-- SECURITY FIX: Whitelist email exposure + Storage RLS + Admin bootstrap
-- =====================================================

-- 1. Fix whitelisted_users: Remove permissive SELECT policy
--    Replace with a policy that only lets users see their OWN whitelist entry
DROP POLICY IF EXISTS "Authenticated users can check whitelist" ON public.whitelisted_users;

CREATE POLICY "Users can only view their own whitelist entry"
  ON public.whitelisted_users
  FOR SELECT
  USING (
    LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- 2. Storage RLS: Add explicit policies for generated-images bucket
--    Note: storage.objects RLS is already enabled by Supabase

-- Users can view their own generated images (path-based)
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
      -- Job folder pattern: jobs/{jobId}/...
      (
        (storage.foldername(name))[1] = 'jobs'
        AND EXISTS (
          SELECT 1 FROM public.generation_jobs
          WHERE id::text = (storage.foldername(name))[2]
          AND user_id = auth.uid()
        )
      )
    )
  );

-- Only service role can insert generated images
DROP POLICY IF EXISTS "Service role can insert generated images" ON storage.objects;
CREATE POLICY "Service role can insert generated images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-images'
    AND auth.jwt()->>'role' = 'service_role'
  );

-- Only service role can update generated images
DROP POLICY IF EXISTS "Service role can update generated images" ON storage.objects;
CREATE POLICY "Service role can update generated images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'generated-images'
    AND auth.jwt()->>'role' = 'service_role'
  );

-- Users can delete their own generated images
DROP POLICY IF EXISTS "Users can delete their own generated images" ON storage.objects;
CREATE POLICY "Users can delete their own generated images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'generated-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      (
        (storage.foldername(name))[1] = 'jobs'
        AND EXISTS (
          SELECT 1 FROM public.generation_jobs
          WHERE id::text = (storage.foldername(name))[2]
          AND user_id = auth.uid()
        )
      )
    )
  );

-- 3. Admin role bootstrap: Insert snapshot@gmail.com as admin
--    This seeds the user_roles table so the role-based is_admin() works
--    without relying solely on the hardcoded email fallback
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE LOWER(email) = 'snapshot@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Allow service role to insert roles (needed for admin management)
DROP POLICY IF EXISTS "Service role can manage roles" ON public.user_roles;
CREATE POLICY "Service role can manage roles"
  ON public.user_roles
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

NOTIFY pgrst, 'reload schema';
