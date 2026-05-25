
-- Helper: read hook secret from app_settings (admins-only table)
CREATE OR REPLACE FUNCTION public.get_hook_secret()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT value->>'value' FROM public.app_settings WHERE key = 'hook_secret'
$$;
REVOKE EXECUTE ON FUNCTION public.get_hook_secret() FROM PUBLIC, anon, authenticated;

-- Reschedule existing cron jobs with x-hook-secret header
DO $$ BEGIN PERFORM cron.unschedule('matka-auto-declare'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('matka-scrape-results'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('matka-backfill-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('matka-auto-declare', '*/5 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://project--b0e60e12-e7bc-4a11-af24-52eae800024b.lovable.app/api/public/hooks/auto-declare-results',
    headers := jsonb_build_object('Content-Type','application/json','x-hook-secret', public.get_hook_secret()),
    body := '{}'::jsonb
  );
$cron$);

SELECT cron.schedule('matka-scrape-results', '*/15 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://project--b0e60e12-e7bc-4a11-af24-52eae800024b.lovable.app/api/public/hooks/scrape-results',
    headers := jsonb_build_object('Content-Type','application/json','x-hook-secret', public.get_hook_secret()),
    body := '{}'::jsonb
  );
$cron$);

SELECT cron.schedule('matka-backfill-daily', '0 22 * * *', $cron$
  SELECT net.http_post(
    url := 'https://project--b0e60e12-e7bc-4a11-af24-52eae800024b.lovable.app/api/public/hooks/backfill-results',
    headers := jsonb_build_object('Content-Type','application/json','x-hook-secret', public.get_hook_secret()),
    body := '{}'::jsonb
  );
$cron$);
