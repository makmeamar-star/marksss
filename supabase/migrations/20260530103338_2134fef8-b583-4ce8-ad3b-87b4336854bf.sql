
-- Tighten auto-declare conflict logic to ignore stale observations,
-- and surface JODI rejections as system alerts.

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
SET search_path TO 'public'
AS $function$
DECLARE
  _min_conf int;
  _conf_count int;
  _conflicting_count int;
  _existing_result text;
  _declare_result jsonb;
  _recent interval := interval '30 minutes';
BEGIN
  IF _pana !~ '^[0-9]{3}$' THEN
    INSERT INTO system_alerts (severity, source, title, message, context)
    VALUES (
      'error','scraper-invalid',
      format('Scraper returned invalid pana for %s %s', _market_id, _session),
      format('Source %s reported "%s" — expected 3-digit pana', _source, _pana),
      jsonb_build_object('market_id', _market_id, 'session_date', _session_date,
                         'session', _session, 'pana', _pana, 'source', _source)
    );
    RETURN jsonb_build_object('status','INVALID','reason','non_3_digit_pana','pana',_pana);
  END IF;

  SELECT COALESCE((value)::text::int, 2) INTO _min_conf
    FROM app_settings WHERE key = 'auto_declare_min_confirmations';
  IF _min_conf IS NULL OR _min_conf < 2 THEN _min_conf := 2; END IF;

  SELECT CASE WHEN _session = 'OPEN' THEN open_pana ELSE close_pana END
    INTO _existing_result
    FROM market_results
   WHERE market_id = _market_id AND session_date = _session_date;
  IF _existing_result IS NOT NULL THEN
    RETURN jsonb_build_object('status','SKIPPED_DECLARED');
  END IF;

  -- Prune stale conflicting observations (>= 6h since last seen) so
  -- yesterday's placeholder values cannot permanently block today's result.
  DELETE FROM result_observations
   WHERE market_id = _market_id
     AND session_date = _session_date
     AND session = _session
     AND pana <> _pana
     AND last_seen_at < now() - interval '6 hours';

  INSERT INTO result_observations (market_id, session_date, session, source, pana)
  VALUES (_market_id, _session_date, _session, _source, _pana)
  ON CONFLICT (market_id, session_date, session, source, pana)
  DO UPDATE SET last_seen_at = now(), seen_count = result_observations.seen_count + 1;

  -- Only RECENT conflicting observations should block declaration.
  SELECT COUNT(*) INTO _conflicting_count
    FROM result_observations
   WHERE market_id = _market_id
     AND session_date = _session_date
     AND session = _session
     AND pana <> _pana
     AND last_seen_at > now() - _recent;

  IF _conflicting_count > 0 THEN
    INSERT INTO system_alerts (severity, source, title, message, context)
    VALUES (
      'warning','scraper-mismatch','Scraper saw conflicting panas',
      format('%s %s: source %s reported %s but another recent observation differs',
             _market_id, _session, _source, _pana),
      jsonb_build_object('market_id', _market_id, 'session_date', _session_date,
                         'session', _session, 'pana', _pana, 'source', _source)
    );
    RETURN jsonb_build_object('status','MISMATCH','pana',_pana);
  END IF;

  -- Confirmations: distinct sources reporting the same pana recently.
  SELECT COUNT(DISTINCT source) INTO _conf_count
    FROM result_observations
   WHERE market_id = _market_id
     AND session_date = _session_date
     AND session = _session
     AND pana = _pana
     AND last_seen_at > now() - _recent;

  IF _conf_count >= _min_conf THEN
    SELECT system_auto_declare(_market_id, _session_date, _session, _pana) INTO _declare_result;
    RETURN jsonb_build_object('status','DECLARED','declare', _declare_result, 'confirmations', _conf_count);
  END IF;

  RETURN jsonb_build_object('status','AWAITING_CONFIRMATION','confirmations', _conf_count, 'needed', _min_conf);
END;
$function$;


CREATE OR REPLACE FUNCTION public.record_jodi_observation_and_maybe_declare(
  _market_id text,
  _session_date date,
  _source text,
  _jodi text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _min_conf int;
  _conf_count int;
  _conflicting_count int;
  _existing text;
  _declare_result jsonb;
  _recent interval := interval '30 minutes';
BEGIN
  IF _jodi !~ '^[0-9]{2}$' THEN
    -- Surface JODI rejection to admins as an alert, not a silent INVALID.
    INSERT INTO system_alerts (severity, source, title, message, context)
    VALUES (
      'error','scraper-jodi-rejected',
      format('JODI rejected for %s', _market_id),
      format('Source %s reported "%s" — expected 2-digit jodi (00–99)', _source, _jodi),
      jsonb_build_object('market_id', _market_id, 'session_date', _session_date,
                         'source', _source, 'jodi', _jodi)
    );
    RETURN jsonb_build_object('status','INVALID','reason','non_2_digit_jodi','jodi',_jodi);
  END IF;

  SELECT COALESCE((value)::text::int, 2) INTO _min_conf
    FROM app_settings WHERE key = 'auto_declare_min_confirmations';
  IF _min_conf IS NULL OR _min_conf < 2 THEN _min_conf := 2; END IF;
  -- Jodi-only markets typically have a single source — relax to 1 there.
  IF (SELECT COUNT(DISTINCT source) FROM market_source_map
       WHERE market_id = _market_id AND enabled) <= 1 THEN
    _min_conf := 1;
  END IF;

  SELECT jodi INTO _existing
    FROM market_results
   WHERE market_id = _market_id AND session_date = _session_date;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('status','SKIPPED_DECLARED');
  END IF;

  -- Prune stale conflicting obs (>= 6h) so old placeholders don't block.
  DELETE FROM result_observations
   WHERE market_id = _market_id
     AND session_date = _session_date
     AND session = 'JODI'
     AND pana <> _jodi
     AND last_seen_at < now() - interval '6 hours';

  INSERT INTO result_observations (market_id, session_date, session, source, pana)
  VALUES (_market_id, _session_date, 'JODI', _source, _jodi)
  ON CONFLICT (market_id, session_date, session, source, pana)
  DO UPDATE SET last_seen_at = now(), seen_count = result_observations.seen_count + 1;

  SELECT COUNT(*) INTO _conflicting_count
    FROM result_observations
   WHERE market_id = _market_id
     AND session_date = _session_date
     AND session = 'JODI'
     AND pana <> _jodi
     AND last_seen_at > now() - _recent;

  IF _conflicting_count > 0 THEN
    INSERT INTO system_alerts (severity, source, title, message, context)
    VALUES (
      'warning','scraper-mismatch','Scraper saw conflicting JODI values',
      format('%s: source %s reported %s but another recent observation differs',
             _market_id, _source, _jodi),
      jsonb_build_object('market_id', _market_id, 'session_date', _session_date,
                         'session', 'JODI', 'jodi', _jodi, 'source', _source)
    );
    RETURN jsonb_build_object('status','MISMATCH','jodi',_jodi);
  END IF;

  SELECT COUNT(DISTINCT source) INTO _conf_count
    FROM result_observations
   WHERE market_id = _market_id
     AND session_date = _session_date
     AND session = 'JODI'
     AND pana = _jodi
     AND last_seen_at > now() - _recent;

  IF _conf_count >= _min_conf THEN
    SELECT system_auto_declare_jodi(_market_id, _session_date, _jodi) INTO _declare_result;
    RETURN jsonb_build_object('status','DECLARED','declare', _declare_result, 'confirmations', _conf_count);
  END IF;

  RETURN jsonb_build_object('status','AWAITING_CONFIRMATION','confirmations', _conf_count, 'needed', _min_conf);
END;
$function$;
