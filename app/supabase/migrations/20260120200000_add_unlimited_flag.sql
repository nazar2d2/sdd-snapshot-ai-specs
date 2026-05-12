-- Add is_unlimited column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN DEFAULT FALSE;

-- Update specific users to have unlimited credits (Placeholder - User to execute with actual emails)
-- Example:
-- UPDATE public.profiles
-- SET is_unlimited = TRUE
-- WHERE id IN (SELECT id FROM auth.users WHERE email IN ('email1@example.com', 'email2@example.com'));
