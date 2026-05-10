
-- Risk summary
CREATE OR REPLACE FUNCTION public.admin_risk_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  _result jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'handle_today', COALESCE((SELECT SUM(amount) FROM bets WHERE session_date = _today), 0),
    'open_exposure', COALESCE((SELECT SUM(amount * payout) FROM bets WHERE status = 'PENDING'), 0),
    'pending_bets', COALESCE((SELECT COUNT(*) FROM bets WHERE status = 'PENDING'), 0),
    'house_pnl_today', COALESCE((
      SELECT SUM(amount) - COALESCE(SUM(win_amount), 0)
      FROM bets WHERE session_date = _today AND status IN ('WON','LOST')
    ), 0),
    'pending_withdrawals', COALESCE((SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'PENDING'), 0),
    'breached_sla', COALESCE((
      SELECT COUNT(*) FROM withdrawal_requests
      WHERE status = 'PENDING' AND sla_due_at IS NOT NULL AND sla_due_at < now()
    ), 0),
    'pending_deposits', COALESCE((SELECT COUNT(*) FROM deposit_requests WHERE status = 'PENDING'), 0),
    'pending_kyc', COALESCE((SELECT COUNT(*) FROM kyc_submissions WHERE status = 'PENDING'), 0),
    'active_users_today', COALESCE((SELECT COUNT(DISTINCT user_id) FROM bets WHERE session_date = _today), 0),
    'suspended_users', COALESCE((SELECT COUNT(*) FROM profiles WHERE status = 'SUSPENDED'), 0)
  ) INTO _result;

  RETURN _result;
END;
$$;

-- Exposure heatmap by market + bet_type
CREATE OR REPLACE FUNCTION public.admin_exposure_heatmap()
RETURNS TABLE(market_id text, bet_type text, bet_number text, total_stake numeric, total_liability numeric, bet_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT b.market_id, b.bet_type, b.bet_number,
         SUM(b.amount)::numeric AS total_stake,
         SUM(b.amount * b.payout)::numeric AS total_liability,
         COUNT(*)::bigint AS bet_count
  FROM bets b
  WHERE b.status = 'PENDING'
  GROUP BY b.market_id, b.bet_type, b.bet_number
  ORDER BY total_liability DESC
  LIMIT 200;
END;
$$;

-- Fraud signals
CREATE OR REPLACE FUNCTION public.admin_fraud_signals()
RETURNS TABLE(user_id uuid, username text, signal text, severity text, detail jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  -- 1. Rapid betting: > 20 bets in last hour
  SELECT p.user_id, p.username, 'RAPID_BETTING'::text, 'medium'::text,
    jsonb_build_object('bets_last_hour', cnt)
  FROM (
    SELECT b.user_id, COUNT(*) AS cnt
    FROM bets b
    WHERE b.created_at > now() - interval '1 hour'
    GROUP BY b.user_id
    HAVING COUNT(*) > 20
  ) x
  JOIN profiles p USING (user_id)

  UNION ALL
  -- 2. Deposit but no bet (potential mule)
  SELECT p.user_id, p.username, 'DEPOSIT_NO_BET'::text, 'high'::text,
    jsonb_build_object('total_deposit', p.total_deposit, 'total_bet', p.total_bet)
  FROM profiles p
  WHERE p.total_deposit >= 1000 AND p.total_bet = 0
    AND p.status = 'ACTIVE'

  UNION ALL
  -- 3. Fast withdraw: withdrawal request within 30min of a deposit approval
  SELECT p.user_id, p.username, 'FAST_WITHDRAW'::text, 'high'::text,
    jsonb_build_object('withdraw_at', w.created_at, 'deposit_at', d.processed_at)
  FROM withdrawal_requests w
  JOIN deposit_requests d ON d.user_id = w.user_id
    AND d.status = 'APPROVED'
    AND d.processed_at IS NOT NULL
    AND w.created_at BETWEEN d.processed_at AND d.processed_at + interval '30 minutes'
  JOIN profiles p ON p.user_id = w.user_id
  WHERE w.created_at > now() - interval '7 days'

  UNION ALL
  -- 4. High loss velocity: lost > 5000 today
  SELECT p.user_id, p.username, 'HIGH_LOSS'::text, 'low'::text,
    jsonb_build_object('loss_today', loss)
  FROM (
    SELECT b.user_id, SUM(b.amount - COALESCE(b.win_amount,0)) AS loss
    FROM bets b
    WHERE b.session_date = (now() AT TIME ZONE 'Asia/Kolkata')::date
      AND b.status IN ('WON','LOST')
    GROUP BY b.user_id
    HAVING SUM(b.amount - COALESCE(b.win_amount,0)) > 5000
  ) y
  JOIN profiles p USING (user_id)
  LIMIT 500;
END;
$$;

-- Bulk user status
CREATE OR REPLACE FUNCTION public.admin_bulk_user_status(_user_ids uuid[], _status text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('ACTIVE','SUSPENDED','FROZEN') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE profiles
  SET status = _status, updated_at = now()
  WHERE user_id = ANY(_user_ids);
  GET DIAGNOSTICS _n = ROW_COUNT;

  INSERT INTO audit_log (action, actor_id, metadata, reason)
  VALUES ('bulk_user_status', auth.uid(),
    jsonb_build_object('user_ids', _user_ids, 'status', _status, 'count', _n),
    'admin bulk action');

  RETURN _n;
END;
$$;
