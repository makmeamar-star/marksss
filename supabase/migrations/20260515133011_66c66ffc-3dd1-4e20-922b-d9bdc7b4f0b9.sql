
-- 1) Neutralize random pana auto-declare. Replace function so it no longer
-- inserts random panas. It still updates last_run_at (kept for audit), but
-- never publishes a result. Manual admin declaration and the 2-source
-- scraper path remain the only ways to publish.
CREATE OR REPLACE FUNCTION public.run_due_auto_declarations()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.market_automation
     SET last_run_at = now()
   WHERE open_enabled OR close_enabled;
  RETURN jsonb_build_object(
    'ran', 0,
    'at', now(),
    'note', 'random auto-declare disabled; results require 2 confirmed sources or manual entry'
  );
END $$;

-- 2) Tighten confirmation rule: require >= 2 DISTINCT sources reporting the
-- same pana. Same-source-twice no longer counts. Still records mismatches.
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
  _conf_count int;
  _conflicting_count int;
  _existing_result text;
  _declare_result jsonb;
BEGIN
  SELECT COALESCE((value)::text::int, 2) INTO _min_conf
    FROM app_settings WHERE key = 'auto_declare_min_confirmations';
  IF _min_conf < 2 THEN _min_conf := 2; END IF;

  SELECT CASE WHEN _session = 'OPEN' THEN open_pana ELSE close_pana END
    INTO _existing_result
    FROM market_results
   WHERE market_id = _market_id AND session_date = _session_date;
  IF _existing_result IS NOT NULL THEN
    RETURN jsonb_build_object('status','SKIPPED_DECLARED');
  END IF;

  INSERT INTO result_observations (market_id, session_date, session, source, pana)
  VALUES (_market_id, _session_date, _session, _source, _pana)
  ON CONFLICT (market_id, session_date, session, source, pana)
  DO UPDATE SET last_seen_at = now(), seen_count = result_observations.seen_count + 1;

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

  -- Strict: count DISTINCT sources only
  SELECT COUNT(DISTINCT source) INTO _conf_count
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

-- 3) Coverage view: per-market source count for today
CREATE OR REPLACE VIEW public.market_source_coverage AS
SELECT
  m.id AS market_id,
  m.display_name,
  COUNT(DISTINCT msm.source) FILTER (WHERE msm.enabled) AS sources_configured,
  ARRAY_AGG(DISTINCT msm.source) FILTER (WHERE msm.enabled) AS sources
FROM public.markets m
LEFT JOIN public.market_source_map msm ON msm.market_id = m.id
WHERE m.status = 'ACTIVE'
GROUP BY m.id, m.display_name;

GRANT SELECT ON public.market_source_coverage TO authenticated;
