
CREATE OR REPLACE FUNCTION public.ensure_demo_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF _email IS DISTINCT FROM 'admin@sattaking.test' THEN
    RETURN;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_demo_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_demo_admin() TO authenticated;
