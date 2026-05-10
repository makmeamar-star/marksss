
DROP VIEW IF EXISTS public.leaderboard_winnings;
CREATE VIEW public.leaderboard_winnings
WITH (security_invoker = true) AS
SELECT
  b.user_id,
  p.username,
  SUM(b.win_amount) FILTER (WHERE b.settled_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')) AS today_won,
  SUM(b.win_amount) FILTER (WHERE b.settled_at >= date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata')) AS week_won,
  SUM(b.win_amount) FILTER (WHERE b.settled_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')) AS month_won
FROM public.bets b
JOIN public.profiles p ON p.user_id = b.user_id
WHERE b.status = 'WON' AND b.win_amount > 0
GROUP BY b.user_id, p.username;

GRANT SELECT ON public.leaderboard_winnings TO anon, authenticated;
