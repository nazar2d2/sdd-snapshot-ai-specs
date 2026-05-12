-- Seed whitelisted users
-- This migration explicitly updates the profiles table to set is_unlimited = true
-- for the specified email addresses.

UPDATE public.profiles
SET is_unlimited = TRUE
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN (
    'maxim@scalemakers.nl', 
    'quintvanloosdregt01@gmail.com', 
    'snapshot@gmail.com', 
    'zakelijkthriveedge@gmail.com'
  )
);
