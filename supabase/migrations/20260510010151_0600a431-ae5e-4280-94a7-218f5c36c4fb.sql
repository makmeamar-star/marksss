
-- 1) Storage: remove broad SELECT on payment-qr bucket (public URL access still works)
DROP POLICY IF EXISTS "Public read payment-qr" ON storage.objects;

-- 2) client_errors: require message, cap lengths to avoid abuse
DROP POLICY IF EXISTS "Anyone can report errors" ON public.client_errors;
CREATE POLICY "Anyone can report errors"
  ON public.client_errors
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(coalesce(message,'')) BETWEEN 1 AND 4000
    AND length(coalesce(stack,'')) <= 8000
    AND length(coalesce(url,'')) <= 2000
    AND length(coalesce(route,'')) <= 500
    AND length(coalesce(user_agent,'')) <= 500
  );

-- 3) Lock down SECURITY DEFINER functions
-- Helpers callable everywhere (used in RLS policies and triggers)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;

-- Trigger-only functions (must not be callable directly)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_bet_settle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_bets_for_suspended() FROM PUBLIC, anon, authenticated;

-- User-callable RPCs: revoke from anon, ensure granted to authenticated
DO $$
DECLARE
  fn TEXT;
  fns TEXT[] := ARRAY[
    'public.place_bets(text, date, jsonb)',
    'public.place_quick_bet(uuid, smallint, numeric)',
    'public.claim_daily_streak()',
    'public.spin_daily_wheel()',
    'public.increment_mission(text, integer)',
    'public.claim_mission(text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END$$;

-- Admin-only RPCs: revoke from anon (function still self-checks has_role)
DO $$
DECLARE
  fn TEXT;
  fns TEXT[] := ARRAY[
    'public.declare_result(text, date, text, text, text)',
    'public.correct_result(text, date, text, text, text)',
    'public.approve_deposit(uuid, text)',
    'public.reject_deposit(uuid, text)',
    'public.approve_withdrawal(uuid, text)',
    'public.reject_withdrawal(uuid, text)',
    'public.admin_set_user_status(uuid, text, text)',
    'public.admin_delete_market(text)',
    'public.admin_adjust_balance(uuid, numeric, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END$$;

-- System / cron-invoked functions: only service_role should run these
REVOKE EXECUTE ON FUNCTION public.run_due_auto_declarations() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.run_due_auto_declarations() TO service_role;

REVOKE EXECUTE ON FUNCTION public.tick_quick_play() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.tick_quick_play() TO service_role;

REVOKE EXECUTE ON FUNCTION public.system_auto_declare(text, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.system_auto_declare(text, date, text, text) TO service_role;
