-- Source map: which slug to use per market per external source
CREATE TABLE public.market_source_map (
  market_id text NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  source text NOT NULL,
  slug text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (market_id, source)
);

ALTER TABLE public.market_source_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads source map"
  ON public.market_source_map FOR SELECT
  USING (true);

CREATE POLICY "Admins manage source map"
  ON public.market_source_map FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Scrape attempt log
CREATE TABLE public.result_scrape_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  market_id text NOT NULL,
  session_date date NOT NULL,
  session text NOT NULL,
  source text NOT NULL,
  status text NOT NULL, -- 'OK' | 'NOT_FOUND' | 'INVALID_PANA' | 'ALREADY_DECLARED' | 'ERROR' | 'WRITTEN'
  pana text,
  error text
);

CREATE INDEX result_scrape_log_run_at_idx ON public.result_scrape_log (run_at DESC);
CREATE INDEX result_scrape_log_market_idx ON public.result_scrape_log (market_id, session_date);

ALTER TABLE public.result_scrape_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read scrape log"
  ON public.result_scrape_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed dpboss slugs for the 8 existing markets
INSERT INTO public.market_source_map (market_id, source, slug) VALUES
  ('kalyan',         'dpboss', 'kalyan'),
  ('madhur-day',     'dpboss', 'madhur-day'),
  ('main-mumbai',    'dpboss', 'main-mumbai'),
  ('milan-day',      'dpboss', 'milan-day'),
  ('milan-night',    'dpboss', 'milan-night'),
  ('rajdhani-day',   'dpboss', 'rajdhani-day'),
  ('rajdhani-night', 'dpboss', 'rajdhani-night'),
  ('time-bazar',     'dpboss', 'time-bazar')
ON CONFLICT DO NOTHING;

-- Allow new SCRAPER mode (no enum, just text — no constraint exists, so nothing to alter)
-- Document: market_automation.mode in {'RANDOM','MANUAL','SCRAPER'}

-- Helper view: latest scrape attempt per market+session+date
CREATE OR REPLACE VIEW public.result_scrape_latest AS
SELECT DISTINCT ON (market_id, session_date, session)
  market_id, session_date, session, source, status, pana, error, run_at
FROM public.result_scrape_log
ORDER BY market_id, session_date, session, run_at DESC;