
-- Drop duplicate / broken jobs that were sending apikey instead of x-hook-secret
SELECT cron.unschedule('scrape-results-every-2min');
SELECT cron.unschedule('process-scrape-queue-every-5min');
SELECT cron.unschedule('auto-declare-results-every-10min');

-- Recreate with correct x-hook-secret header at frequent intervals
SELECT cron.schedule(
  'scrape-results-every-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--b0e60e12-e7bc-4a11-af24-52eae800024b.lovable.app/api/public/hooks/scrape-results',
    headers := jsonb_build_object('Content-Type','application/json','x-hook-secret', public.get_hook_secret()),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'process-scrape-queue-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--b0e60e12-e7bc-4a11-af24-52eae800024b.lovable.app/api/public/hooks/process-scrape-queue',
    headers := jsonb_build_object('Content-Type','application/json','x-hook-secret', public.get_hook_secret()),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'auto-declare-results-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--b0e60e12-e7bc-4a11-af24-52eae800024b.lovable.app/api/public/hooks/auto-declare-results',
    headers := jsonb_build_object('Content-Type','application/json','x-hook-secret', public.get_hook_secret()),
    body := '{}'::jsonb
  );
  $$
);
