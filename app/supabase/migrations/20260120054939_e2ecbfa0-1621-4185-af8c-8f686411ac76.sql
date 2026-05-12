-- Create whitelist table for users who get unlimited free generations
CREATE TABLE IF NOT EXISTS public.whitelisted_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT
);

-- Enable RLS
ALTER TABLE public.whitelisted_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view/modify whitelist (no public access)
-- For now, only service role can access this table

-- Insert the initial whitelisted users
INSERT INTO public.whitelisted_users (email, reason) VALUES
  ('maxim@scalemakers.nl', 'Founder'),
  ('quintvanloosdreght01@gmail.com', 'Team member'),
  ('snapshot@gmail.com', 'Team member'),
  ('zakelijkthriveeedge@gmail.com', 'Team member')
ON CONFLICT (email) DO NOTHING;

-- Create a function to check if a user is whitelisted (for use in edge functions)
CREATE OR REPLACE FUNCTION public.is_whitelisted(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whitelisted_users WHERE LOWER(email) = LOWER(user_email)
  );
$$;