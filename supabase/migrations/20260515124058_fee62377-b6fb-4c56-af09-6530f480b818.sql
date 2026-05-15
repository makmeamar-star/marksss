
-- 1. Observations table
CREATE TABLE IF NOT EXISTS public.result_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id text NOT NULL,
  session_date date NOT NULL,
  session text NOT NULL CHECK (session IN ('OPEN','CLOSE')),
  source text NOT NULL,
  pana text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  seen_count integer NOT NULL DEFAULT 1,
  UNIQUE (market_id, session_date, session, source, pana)
);

CREATE INDEX IF NOT EXISTS idx_result_obs_lookup
  ON public.result_observations (market_id, session_date, session);

ALTER TABLE public.result_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read observations"
  ON public.result_observations FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Settings (idempotent upserts)
INSERT INTO public.app_settings (key, value)
VALUES
  ('auto_declare_min_confirmations', '2'::jsonb),
  ('auto_declare_min_age_minutes', '4'::jsonb),
  ('manual_declare_grace_minutes', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Confirm-twice RPC
CREATE OR REPLACE FUNCTION public.record_observation_and_maybe_declare(
  _market_id text,
  _session_date date,
  _session text,
  _source text,
  _pana text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _min_conf int;
  _min_age_min int;
  _conf_count int;
  _conflicting_count int;
  _existing_result text;
  _declare_result jsonb;
BEGIN
  SELECT COALESCE((value)::text::int, 2) INTO _min_conf
    FROM app_settings WHERE key = 'auto_declare_min_confirmations';
  SELECT COALESCE((value)::text::int, 4) INTO _min_age_min
    FROM app_settings WHERE key = 'auto_declare_min_age_minutes';

  -- Already declared? Skip.
  SELECT CASE WHEN _session = 'OPEN' THEN open_pana ELSE close_pana END
    INTO _existing_result
    FROM market_results
   WHERE market_id = _market_id AND session_date = _session_date;
  IF _existing_result IS NOT NULL THEN
    RETURN jsonb_build_object('status','SKIPPED_DECLARED');
  END IF;

  -- Upsert this observation
  INSERT INTO result_observations (market_id, session_date, session, source, pana)
  VALUES (_market_id, _session_date, _session, _source, _pana)
  ON CONFLICT (market_id, session_date, session, source, pana)
  DO UPDATE SET last_seen_at = now(), seen_count = result_observations.seen_count + 1;

  -- Mismatch detection: any other pana observed for same key?
  SELECT COUNT(*) INTO _conflicting_count
    FROM result_observations
   WHERE market_id = _market_id
     AND session_date = _session_date
     AND session = _session
     AND pana <> _pana;

  IF _conflicting_count > 0 THEN
    INSERT INTO system_alerts (severity, source, title, message, context)
    VALUES (
      'warning',
      'scraper-mismatch',
      'Scraper saw conflicting panas',
      format('%s %s: source %s reported %s but earlier observations differ', _market_id, _session, _source, _pana),
      jsonb_build_object('market_id', _market_id, 'session_date', _session_date, 'session', _session, 'pana', _pana, 'source', _source)
    );
    RETURN jsonb_build_object('status','MISMATCH');
  END IF;

  -- Count qualifying confirmations: distinct (source) rows OR same source observed across two scrape runs spaced >= _min_age_min minutes
  SELECT
    GREATEST(
      COUNT(DISTINCT source),
      MAX(CASE
        WHEN EXTRACT(EPOCH FROM (last_seen_at - first_seen_at)) / 60.0 >= _min_age_min
        THEN 2 ELSE 1 END)
    )
  INTO _conf_count
  FROM result_observations
  WHERE market_id = _market_id
    AND session_date = _session_date
    AND session = _session
    AND pana = _pana;

  IF _conf_count >= _min_conf THEN
    SELECT system_auto_declare(_market_id, _session_date, _session, _pana) INTO _declare_result;
    RETURN jsonb_build_object('status','DECLARED','declare', _declare_result, 'confirmations', _conf_count);
  END IF;

  RETURN jsonb_build_object('status','AWAITING_CONFIRMATION','confirmations', _conf_count, 'needed', _min_conf);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_observation_and_maybe_declare(text,date,text,text,text) TO service_role, authenticated;

-- 4. Missing results detector
CREATE OR REPLACE FUNCTION public.find_missing_results()
RETURNS TABLE (
  market_id text,
  display_name text,
  session text,
  scheduled_time text,
  minutes_overdue int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grace_min int;
  _now_ist timestamp;
  _today date;
  _today_dow text;
BEGIN
  SELECT COALESCE((value)::text::int, 10) INTO _grace_min
    FROM app_settings WHERE key = 'manual_declare_grace_minutes';

  _now_ist := (now() AT TIME ZONE 'Asia/Kolkata')::timestamp;
  _today := _now_ist::date;
  _today_dow := upper(to_char(_now_ist, 'Dy')); -- e.g. MON, TUE

  RETURN QUERY
  WITH market_today AS (
    SELECT m.id, m.display_name, m.open_time, m.close_time,
           (m.open_time::time)  AS open_t,
           (m.close_time::time) AS close_t
      FROM markets m
     WHERE m.status = 'ACTIVE'
       AND EXISTS (
         SELECT 1 FROM unnest(m.days) AS d
          WHERE upper(substr(d,1,3)) = _today_dow
       )
  ),
  result_today AS (
    SELECT mr.market_id, mr.open_pana, mr.close_pana
      FROM market_results mr
     WHERE mr.session_date = _today
  )
  SELECT mt.id,
         mt.display_name,
         s.sess,
         CASE WHEN s.sess = 'OPEN' THEN mt.open_time ELSE mt.close_time END,
         GREATEST(0, EXTRACT(EPOCH FROM (_now_ist - (
           _today + (CASE WHEN s.sess='OPEN' THEN mt.open_t ELSE mt.close_t END)
         )))/60)::int
    FROM market_today mt
   CROSS JOIN (VALUES ('OPEN'::text), ('CLOSE'::text)) AS s(sess)
   LEFT JOIN result_today rt ON rt.market_id = mt.id
   WHERE
     CASE WHEN s.sess='OPEN'
          THEN _now_ist > (_today + mt.open_t  + make_interval(mins => _grace_min))
               AND COALESCE(rt.open_pana,'')  = ''
          ELSE _now_ist > (_today + mt.close_t + make_interval(mins => _grace_min))
               AND COALESCE(rt.close_pana,'') = ''
     END
   ORDER BY 5 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_missing_results() TO service_role, authenticated;
