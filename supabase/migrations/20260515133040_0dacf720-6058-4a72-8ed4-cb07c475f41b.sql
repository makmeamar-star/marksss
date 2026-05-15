DROP VIEW IF EXISTS public.market_source_coverage;
CREATE VIEW public.market_source_coverage
WITH (security_invoker = true)
AS
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