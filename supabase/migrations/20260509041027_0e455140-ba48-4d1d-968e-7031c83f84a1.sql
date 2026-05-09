DROP VIEW IF EXISTS public.result_scrape_latest;
CREATE VIEW public.result_scrape_latest WITH (security_invoker=on) AS
SELECT DISTINCT ON (market_id, session_date, session)
  market_id, session_date, session, source, status, pana, error, run_at
FROM public.result_scrape_log
ORDER BY market_id, session_date, session, run_at DESC;