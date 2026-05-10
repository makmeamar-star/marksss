
REVOKE EXECUTE ON FUNCTION public.claim_daily_streak() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.spin_daily_wheel() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_mission(TEXT, INT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_mission(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_daily_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spin_daily_wheel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_mission(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mission(TEXT) TO authenticated;
