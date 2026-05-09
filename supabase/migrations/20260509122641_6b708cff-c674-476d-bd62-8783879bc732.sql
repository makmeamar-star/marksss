
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.market_results;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
