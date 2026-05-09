
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable automation for all active markets (both OPEN and CLOSE sessions)
UPDATE public.market_automation
SET open_enabled = true, close_enabled = true, mode = 'RANDOM', grace_minutes = 2;

-- Ensure every active market has an automation row and source map row
INSERT INTO public.market_automation (market_id, open_enabled, close_enabled, mode, grace_minutes)
SELECT id, true, true, 'RANDOM', 2 FROM public.markets WHERE status = 'ACTIVE'
ON CONFLICT (market_id) DO UPDATE SET open_enabled = true, close_enabled = true;

INSERT INTO public.market_source_map (market_id, source, slug, enabled)
SELECT id, 'dpboss', id, true FROM public.markets WHERE status = 'ACTIVE'
ON CONFLICT (market_id, source) DO UPDATE SET enabled = true;

-- Remove any prior schedules with the same names (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('matka-auto-declare');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('matka-scrape-results');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('matka-backfill-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Auto-declare RPC every 5 minutes (server-side; checks each market's open/close + grace)
SELECT cron.schedule(
  'matka-auto-declare',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef1d2cf5-c490-445a-ae0d-f01e7b09548a.lovable.app/api/public/hooks/auto-declare-results',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYWhta2p1dGtmeWh5ZGZnZmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjg5NDgsImV4cCI6MjA5Mzg0NDk0OH0.oNwODHJk0XhGlzKUjwR1g0Vjv3XyhZ3PyOaPSEcLAto"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Scrape real dpboss results every 15 minutes
SELECT cron.schedule(
  'matka-scrape-results',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef1d2cf5-c490-445a-ae0d-f01e7b09548a.lovable.app/api/public/hooks/scrape-results',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYWhta2p1dGtmeWh5ZGZnZmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjg5NDgsImV4cCI6MjA5Mzg0NDk0OH0.oNwODHJk0XhGlzKUjwR1g0Vjv3XyhZ3PyOaPSEcLAto"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Daily history backfill at 03:30 IST (22:00 UTC)
SELECT cron.schedule(
  'matka-backfill-daily',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ef1d2cf5-c490-445a-ae0d-f01e7b09548a.lovable.app/api/public/hooks/backfill-results',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYWhta2p1dGtmeWh5ZGZnZmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNjg5NDgsImV4cCI6MjA5Mzg0NDk0OH0.oNwODHJk0XhGlzKUjwR1g0Vjv3XyhZ3PyOaPSEcLAto"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
