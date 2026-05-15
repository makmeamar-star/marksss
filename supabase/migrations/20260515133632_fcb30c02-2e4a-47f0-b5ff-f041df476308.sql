-- 1) Star/jodi-only marker on markets
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS is_jodi_only boolean NOT NULL DEFAULT false;

-- 2) Allow result_observations.session = 'JODI' (no schema constraint exists,
-- session is a free text column). We'll use 'JODI' as the synthetic session
-- value for jodi-only markets so the existing observation table is reused.
-- Make sure the upsert key on result_observations covers this composite.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'result_observations'
      AND indexname = 'result_observations_uniq'
  ) THEN
    CREATE UNIQUE INDEX result_observations_uniq
      ON public.result_observations (market_id, session_date, session, source, pana);
  END IF;
END$$;

-- 3) Auto-declare a jodi-only market: writes a single market_results row with
-- jodi + derived open_digit/close_digit, status='DECLARED'. Settles JODI bets
-- and (for completeness) SINGLE bets on either derived digit.
CREATE OR REPLACE FUNCTION public.system_auto_declare_jodi(
  _market_id text,
  _session_date date,
  _jodi text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _open_digit smallint;
  _close_digit smallint;
  _bet RECORD;
  _won boolean;
  _payouts jsonb;
  _mult numeric;
  _settled int := 0;
BEGIN
  IF _jodi !~ '^[0-9]{2}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_jodi');
  END IF;

  _open_digit  := substring(_jodi from 1 for 1)::smallint;
  _close_digit := substring(_jodi from 2 for 1)::smallint;

  IF EXISTS (SELECT 1 FROM market_results
             WHERE market_id = _market_id AND session_date = _session_date
               AND status = 'DECLARED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_declared');
  END IF;

  INSERT INTO market_results (
    market_id, session_date,
    open_pana, open_digit, close_pana, close_digit, jodi,
    status, declared_at
  ) VALUES (
    _market_id, _session_date,
    NULL, _open_digit, NULL, _close_digit, _jodi,
    'DECLARED', now()
  )
  ON CONFLICT (market_id, session_date) DO UPDATE
    SET open_digit = EXCLUDED.open_digit,
        close_digit = EXCLUDED.close_digit,
        jodi = EXCLUDED.jodi,
        status = 'DECLARED',
        declared_at = now(),
        updated_at = now();

  SELECT payouts INTO _payouts FROM markets WHERE id = _market_id;

  FOR _bet IN
    SELECT * FROM bets
     WHERE market_id = _market_id
       AND session_date = _session_date
       AND status = 'PENDING'
       AND bet_type IN ('JODI','SINGLE')
  LOOP
    IF _bet.bet_type = 'JODI' THEN
      _won := _bet.bet_number = _jodi;
      _mult := COALESCE((_payouts->>'jodi')::numeric, 90);
    ELSE
      _won := _bet.bet_number IN (_open_digit::text, _close_digit::text);
      _mult := COALESCE((_payouts->>'single')::numeric, 9);
    END IF;

    UPDATE bets
       SET status = CASE WHEN _won THEN 'WON' ELSE 'LOST' END,
           win_amount = CASE WHEN _won THEN amount * _mult ELSE 0 END,
           settled_at = now()
     WHERE id = _bet.id;

    IF _won THEN
      UPDATE profiles
         SET balance = balance + _bet.amount * _mult,
             total_win = total_win + _bet.amount * _mult
       WHERE user_id = _bet.user_id;
    END IF;

    _settled := _settled + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'jodi', _jodi, 'settled', _settled);
END $$;

REVOKE EXECUTE ON FUNCTION public.system_auto_declare_jodi(text,date,text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.system_auto_declare_jodi(text,date,text) TO service_role;

-- 4) Record a jodi observation; declare once >=2 distinct sources agree.
CREATE OR REPLACE FUNCTION public.record_jodi_observation_and_maybe_declare(
  _market_id text,
  _session_date date,
  _source text,
  _jodi text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _min_conf int;
  _conf_count int;
  _conflicting_count int;
  _existing text;
  _declare_result jsonb;
BEGIN
  IF _jodi !~ '^[0-9]{2}$' THEN
    RETURN jsonb_build_object('status','INVALID');
  END IF;

  SELECT COALESCE((value)::text::int, 2) INTO _min_conf
    FROM app_settings WHERE key = 'auto_declare_min_confirmations';
  IF _min_conf IS NULL OR _min_conf < 2 THEN _min_conf := 2; END IF;

  SELECT jodi INTO _existing
    FROM market_results
   WHERE market_id = _market_id AND session_date = _session_date;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('status','SKIPPED_DECLARED');
  END IF;

  INSERT INTO result_observations (market_id, session_date, session, source, pana)
  VALUES (_market_id, _session_date, 'JODI', _source, _jodi)
  ON CONFLICT (market_id, session_date, session, source, pana)
  DO UPDATE SET last_seen_at = now(), seen_count = result_observations.seen_count + 1;

  SELECT COUNT(*) INTO _conflicting_count
    FROM result_observations
   WHERE market_id = _market_id
     AND session_date = _session_date
     AND session = 'JODI'
     AND pana <> _jodi;

  IF _conflicting_count > 0 THEN
    INSERT INTO system_alerts (severity, source, title, message, context)
    VALUES (
      'warning', 'scraper-mismatch',
      'Scraper saw conflicting jodis',
      format('%s JODI: source %s reported %s but earlier observations differ', _market_id, _source, _jodi),
      jsonb_build_object('market_id', _market_id, 'session_date', _session_date, 'jodi', _jodi, 'source', _source)
    );
    RETURN jsonb_build_object('status','MISMATCH');
  END IF;

  SELECT COUNT(DISTINCT source) INTO _conf_count
    FROM result_observations
   WHERE market_id = _market_id
     AND session_date = _session_date
     AND session = 'JODI'
     AND pana = _jodi;

  IF _conf_count >= _min_conf THEN
    SELECT system_auto_declare_jodi(_market_id, _session_date, _jodi) INTO _declare_result;
    RETURN jsonb_build_object('status','DECLARED','declare', _declare_result, 'confirmations', _conf_count);
  END IF;

  RETURN jsonb_build_object('status','AWAITING_CONFIRMATION','confirmations', _conf_count, 'needed', _min_conf);
END $$;

REVOKE EXECUTE ON FUNCTION public.record_jodi_observation_and_maybe_declare(text,date,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_jodi_observation_and_maybe_declare(text,date,text,text) TO service_role, authenticated;

-- 5) Seed the 4 star jodi markets (idempotent)
INSERT INTO public.markets
  (id, name, display_name, open_time, close_time, result_time, days, status, min_bet, max_bet, payouts, is_jodi_only)
VALUES
  ('gali','gali','Gali','22:30','23:30','23:50',
    ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN'],'ACTIVE',10,10000,
    '{"single":9,"jodi":95}'::jsonb, true),
  ('disawar','disawar','Disawar','02:30','05:00','05:30',
    ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN'],'ACTIVE',10,10000,
    '{"single":9,"jodi":95}'::jsonb, true),
  ('faridabad','faridabad','Faridabad','17:00','18:00','18:30',
    ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN'],'ACTIVE',10,10000,
    '{"single":9,"jodi":95}'::jsonb, true),
  ('ghaziabad','ghaziabad','Ghaziabad','20:00','21:00','21:30',
    ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN'],'ACTIVE',10,10000,
    '{"single":9,"jodi":95}'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET is_jodi_only = true;

-- 6) Seed source mappings for star markets across all 4 sources
INSERT INTO public.market_source_map (market_id, source, slug, enabled) VALUES
  ('gali','sattakingvip','gali',true),
  ('gali','galidisawar','gali',true),
  ('gali','sattamatkadpboss','gali',true),
  ('gali','fixresult','gali',true),
  ('disawar','sattakingvip','disawar',true),
  ('disawar','galidisawar','disawar',true),
  ('disawar','sattamatkadpboss','disawar',true),
  ('disawar','fixresult','disawar',true),
  ('faridabad','sattakingvip','faridabad',true),
  ('faridabad','galidisawar','faridabad',true),
  ('faridabad','sattamatkadpboss','faridabad',true),
  ('faridabad','fixresult','faridabad',true),
  ('ghaziabad','sattakingvip','ghaziabad',true),
  ('ghaziabad','galidisawar','ghaziabad',true),
  ('ghaziabad','sattamatkadpboss','ghaziabad',true),
  ('ghaziabad','fixresult','ghaziabad',true)
ON CONFLICT (market_id, source) DO UPDATE SET slug = EXCLUDED.slug, enabled = true;
