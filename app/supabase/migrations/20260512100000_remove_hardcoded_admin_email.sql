-- Remove hardcoded admin email from is_admin(); rely on user_roles (has_role) only.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.has_role(auth.uid(), 'admin');
END;
$$;

NOTIFY pgrst, 'reload schema';
