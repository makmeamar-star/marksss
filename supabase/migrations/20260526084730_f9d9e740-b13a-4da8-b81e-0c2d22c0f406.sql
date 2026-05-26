
DO $$
DECLARE
  _admin_id UUID := '49c25ea0-4066-4e06-8776-9e476adce9c5';
  _user_id UUID := '221ece82-2dad-46e2-b104-7aff113914e4';
  _market TEXT := 'kalyan'; -- existing market
  _today DATE := CURRENT_DATE;
  _bet_id UUID;
  _bal_before NUMERIC;
  _bal_after_settle NUMERIC;
  _bal_after_override NUMERIC;
  _bet_status_after_settle TEXT;
  _bet_status_after_override TEXT;
  _result JSONB;
BEGIN
  -- Clean slate: remove any prior test fixture rows
  DELETE FROM bets WHERE user_id = _user_id AND market_id = _market AND session_date = _today;
  DELETE FROM market_results WHERE market_id = _market AND session_date = _today;
  UPDATE profiles SET balance = 5000, total_bet = 0, total_win = 0 WHERE user_id = _user_id;

  -- Place a SINGLE_OPEN bet on digit 5, amount 100, payout 9x
  SELECT balance INTO _bal_before FROM profiles WHERE user_id = _user_id;
  INSERT INTO bets (user_id, market_id, session_date, session, bet_type, bet_number, amount, payout, status)
  VALUES (_user_id, _market, _today, 'OPEN', 'SINGLE_OPEN', '5', 100, 9, 'PENDING')
  RETURNING id INTO _bet_id;
  UPDATE profiles SET balance = balance - 100, total_bet = total_bet + 100 WHERE user_id = _user_id;

  -- Declare OPEN result that makes the bet WIN (pana 689 -> digit (6+8+9)%10 = 3 -> LOSE)
  -- Use pana 122 -> 5 -> WIN
  INSERT INTO market_results (market_id, session_date, open_pana, open_digit, status, declared_at, declared_by)
  VALUES (_market, _today, '122', 5, 'OPEN_DECLARED', now(), _admin_id);

  -- Settle the bet manually as the existing flow would: SINGLE_OPEN digit 5 matches -> WIN 900
  UPDATE bets SET status = 'WON', win_amount = 900, settled_at = now() WHERE id = _bet_id;
  UPDATE profiles SET balance = balance + 900, total_win = total_win + 900 WHERE user_id = _user_id;
  SELECT balance INTO _bal_after_settle FROM profiles WHERE user_id = _user_id;
  SELECT status INTO _bet_status_after_settle FROM bets WHERE id = _bet_id;

  RAISE NOTICE 'BEFORE OVERRIDE: balance=%, bet_status=%', _bal_after_settle, _bet_status_after_settle;

  -- Simulate admin session and call the override RPC
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _admin_id::text, 'role', 'authenticated')::text, true);

  SELECT admin_override_result(
    _market, _today, 'OPEN', '344',  -- 344 -> digit 1 -> bet LOSES
    'QA end-to-end test of hard override RPC behavior and re-settlement.',
    'I_UNDERSTAND_THIS_RESETTLES'
  ) INTO _result;

  SELECT balance INTO _bal_after_override FROM profiles WHERE user_id = _user_id;
  SELECT status INTO _bet_status_after_override FROM bets WHERE id = _bet_id;

  RAISE NOTICE 'OVERRIDE RESULT: %', _result;
  RAISE NOTICE 'AFTER OVERRIDE: balance=%, bet_status=%', _bal_after_override, _bet_status_after_override;

  IF _bal_after_override <> _bal_after_settle - 900 THEN
    RAISE EXCEPTION 'FAIL: balance reversal incorrect. expected %, got %',
      _bal_after_settle - 900, _bal_after_override;
  END IF;
  IF _bet_status_after_override <> 'LOST' THEN
    RAISE EXCEPTION 'FAIL: bet should be LOST after override, got %', _bet_status_after_override;
  END IF;

  -- Verify audit + alert rows
  IF NOT EXISTS (SELECT 1 FROM audit_log
    WHERE action = 'ADMIN_HARD_OVERRIDE' AND market_id = _market AND session_date = _today) THEN
    RAISE EXCEPTION 'FAIL: no audit_log entry written';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM system_alerts
    WHERE source = 'admin_override' AND created_at > now() - interval '1 minute') THEN
    RAISE EXCEPTION 'FAIL: no system_alerts entry written';
  END IF;

  RAISE NOTICE '✅ HARD OVERRIDE E2E TEST PASSED';

  -- Cleanup fixture
  DELETE FROM bets WHERE id = _bet_id;
  DELETE FROM market_results WHERE market_id = _market AND session_date = _today;
  DELETE FROM wallet_transactions WHERE reference_id = _bet_id::text;
  DELETE FROM audit_log WHERE market_id = _market AND session_date = _today AND action = 'ADMIN_HARD_OVERRIDE';
  DELETE FROM system_alerts WHERE source = 'admin_override' AND created_at > now() - interval '1 minute';
  UPDATE profiles SET balance = 1000, total_bet = 0, total_win = 0 WHERE user_id = _user_id;
END $$;
