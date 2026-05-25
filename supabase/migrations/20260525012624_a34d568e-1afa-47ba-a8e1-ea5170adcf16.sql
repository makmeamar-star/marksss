CREATE OR REPLACE FUNCTION public.record_observation_and_maybe_declare(_market_id text, _session_date date, _session text, _source text, _pana text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _min_conf int;
  _conf_count int;
  _conflicting_count int;
  _existing_result text;
  _declare_result jsonb;
BEGIN
  SELECT COALESCE((value)::text::int, 1) INTO _min_conf
    FROM app_settings WHERE key = 'auto_declare_min_confirmations';
  IF _min_conf < 1 THEN _min_conf := 1; END IF;

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
$function$;