
-- 1. Unique index for (market_id, session_date)
CREATE UNIQUE INDEX IF NOT EXISTS market_results_market_session_uniq
  ON public.market_results (market_id, session_date);

-- 2. Admin delete/deactivate market function
CREATE OR REPLACE FUNCTION public.admin_delete_market(_market_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _has_bets boolean;
  _has_results boolean;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.bets WHERE market_id = _market_id) INTO _has_bets;
  SELECT EXISTS(SELECT 1 FROM public.market_results WHERE market_id = _market_id) INTO _has_results;

  IF _has_bets OR _has_results THEN
    UPDATE public.markets SET status = 'INACTIVE', updated_at = now() WHERE id = _market_id;
    INSERT INTO public.audit_log (actor_id, actor_email, action, market_id, metadata)
    VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin),
            'MARKET_DEACTIVATE', _market_id,
            jsonb_build_object('reason','referenced_by_history'));
    RETURN jsonb_build_object('success', true, 'soft', true);
  END IF;

  DELETE FROM public.market_automation WHERE market_id = _market_id;
  DELETE FROM public.markets WHERE id = _market_id;
  INSERT INTO public.audit_log (actor_id, actor_email, action, market_id, metadata)
  VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin),
          'MARKET_DELETE', _market_id, '{}'::jsonb);
  RETURN jsonb_build_object('success', true, 'soft', false);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_market(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_market(text) TO authenticated;

-- 3. Seed 90 days of historical results for every market
DO $$
DECLARE
  _m RECORD;
  _d date;
  _dow_short text;
  _open_pana text; _open_digit smallint;
  _close_pana text; _close_digit smallint;
BEGIN
  FOR _m IN SELECT id, days, close_time FROM public.markets LOOP
    FOR i IN 1..90 LOOP
      _d := (current_date - i);
      _dow_short := upper(to_char(_d, 'Dy')); -- MON, TUE...
      -- skip days the market doesn't operate
      IF NOT (_m.days @> ARRAY[_dow_short]::text[]) THEN
        CONTINUE;
      END IF;

      SELECT pana, digit INTO _open_pana, _open_digit
        FROM public.pana_chart ORDER BY random() LIMIT 1;
      SELECT pana, digit INTO _close_pana, _close_digit
        FROM public.pana_chart ORDER BY random() LIMIT 1;

      INSERT INTO public.market_results
        (market_id, session_date, open_pana, open_digit, close_pana, close_digit,
         jodi, status, declared_at, declared_by)
      VALUES
        (_m.id, _d, _open_pana, _open_digit, _close_pana, _close_digit,
         _open_digit::text || _close_digit::text, 'DECLARED',
         (_d::timestamp + _m.close_time::time) AT TIME ZONE 'Asia/Kolkata',
         NULL)
      ON CONFLICT (market_id, session_date) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
