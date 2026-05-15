
-- Revoke direct EXECUTE on the internal auto-declare functions from public/anon/authenticated.
-- These are only meant to be called by the scraper-confirmation RPCs
-- (record_observation_and_maybe_declare / record_jodi_observation_and_maybe_declare),
-- which run as SECURITY DEFINER and therefore can still invoke them.
REVOKE EXECUTE ON FUNCTION public.system_auto_declare(text, date, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.system_auto_declare_jodi(text, date, text) FROM PUBLIC, anon, authenticated;

-- Belt-and-braces: ensure the random scheduler stays neutralized.
CREATE OR REPLACE FUNCTION public.run_due_auto_declarations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Random/time-based auto-declare is permanently disabled.
  -- Results may only enter via:
  --   1. the scraper confirmation flow (record_observation_and_maybe_declare),
  --   2. or an admin manual entry (declare_result / correct_result).
  UPDATE public.market_automation
     SET last_run_at = now()
   WHERE open_enabled OR close_enabled;
  RETURN jsonb_build_object(
    'ran', 0,
    'at', now(),
    'note', 'random auto-declare disabled; results require scraper 2-source confirmation or admin manual entry'
  );
END $function$;

-- Add a guard inside system_auto_declare so even if invoked, it only writes
-- results sourced from a confirmed scrape observation. This makes the
-- "scraper or manual admin only" rule enforceable at the database layer.
CREATE OR REPLACE FUNCTION public.system_auto_declare(_market_id text, _session_date date, _session text, _pana text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _confirmed_sources INT;
BEGIN
  -- Require at least one matching scrape observation for this market/session/date/pana.
  -- The confirmation RPC raises seen_count and inserts per-source rows; if none
  -- exist, refuse to publish (prevents direct/manual misuse of this function).
  SELECT COUNT(DISTINCT source) INTO _confirmed_sources
  FROM public.result_observations
  WHERE market_id = _market_id
    AND session_date = _session_date
    AND session = _session
    AND pana = _pana;

  IF _confirmed_sources < 1 THEN
    RAISE EXCEPTION 'SCRAPER_CONFIRMATION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- Delegate to the existing implementation kept under a private name.
  RETURN public._do_system_auto_declare(_market_id, _session_date, _session, _pana);
END $function$;

REVOKE EXECUTE ON FUNCTION public.system_auto_declare(text, date, text, text) FROM PUBLIC, anon, authenticated;
