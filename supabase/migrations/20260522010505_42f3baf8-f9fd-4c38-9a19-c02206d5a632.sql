ALTER TABLE public.pwa_install_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pwa_install_events;