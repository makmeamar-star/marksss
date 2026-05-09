
DROP FUNCTION IF EXISTS public.ensure_demo_admin();

CREATE FUNCTION public.ensure_demo_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _confirmed timestamptz;
  _already boolean;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  SELECT lower(email), email_confirmed_at
    INTO _email, _confirmed
  FROM auth.users WHERE id = _uid;

  IF _email IS DISTINCT FROM 'admin@sattaking.test' THEN RETURN false; END IF;
  IF _confirmed IS NULL THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin'
  ) INTO _already;
  IF _already THEN RETURN true; END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.audit_log (actor_id, actor_email, action, reason, metadata)
  VALUES (_uid, _email, 'DEMO_ADMIN_PROMOTE',
          'ensure_demo_admin() granted admin role to demo account',
          jsonb_build_object('source', 'ensure_demo_admin'));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_demo_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_demo_admin() FROM anon;
GRANT  EXECUTE ON FUNCTION public.ensure_demo_admin() TO authenticated;
