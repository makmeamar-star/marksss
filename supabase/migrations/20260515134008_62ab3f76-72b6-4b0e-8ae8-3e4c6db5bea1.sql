UPDATE public.markets m
SET status = 'INACTIVE', updated_at = now()
WHERE m.status = 'ACTIVE'
  AND m.is_jodi_only = false
  AND NOT EXISTS (
    SELECT 1 FROM public.market_source_map msm
    WHERE msm.market_id = m.id
      AND msm.enabled = true
      AND msm.source IN ('sattamatkadpboss','fixresult')
  );

-- Also disable automation rows so the cron doesn't keep ticking on them
UPDATE public.market_automation ma
SET open_enabled = false, close_enabled = false, updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM public.markets m
  WHERE m.id = ma.market_id AND m.status = 'INACTIVE'
);
