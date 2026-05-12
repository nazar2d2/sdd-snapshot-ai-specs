-- Robust Fix for Whitelist (Works for future signups too)

-- 1. Update the Trigger Function to check email list on creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  should_be_unlimited BOOLEAN := FALSE;
BEGIN
  -- Check if the email matches one of the VIPs
  -- We use ILIKE/LOWER to ensure case-insensitivity
  IF LOWER(new.email) IN (
    'maxim@scalemakers.nl', 
    'quintvanloosdregt01@gmail.com', 
    'snapshot@gmail.com', 
    'zakelijkthriveedge@gmail.com'
  ) THEN
    should_be_unlimited := TRUE;
  END IF;

  INSERT INTO public.profiles (id, credits, subscription_tier, is_unlimited)
  VALUES (new.id, 0, 'none', should_be_unlimited);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Force Update existing profiles (in case they already signed up)
UPDATE public.profiles
SET is_unlimited = TRUE
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE LOWER(email) IN (
    'maxim@scalemakers.nl', 
    'quintvanloosdregt01@gmail.com', 
    'snapshot@gmail.com', 
    'zakelijkthriveedge@gmail.com'
  )
);
