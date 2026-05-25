
-- 1. payment_channels: restrict to authenticated only
DROP POLICY IF EXISTS "Anyone reads active channels" ON public.payment_channels;
CREATE POLICY "Authenticated read active channels" ON public.payment_channels
  FOR SELECT TO authenticated
  USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

-- 2. market_automation: admin only
DROP POLICY IF EXISTS "Anyone reads automation" ON public.market_automation;
-- (admin manage policy remains)

-- 3. market_source_map: admin only
DROP POLICY IF EXISTS "Anyone reads source map" ON public.market_source_map;
-- (admin manage policy remains)

-- 4. user_missions: drop user write, keep user read; writes via SECURITY DEFINER rpc only
DROP POLICY IF EXISTS "own missions write" ON public.user_missions;

-- 5. user_streaks: drop user write
DROP POLICY IF EXISTS "own streak write" ON public.user_streaks;

-- 6. profiles: lock sensitive fields, allow only phone/username edits
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND balance         = (SELECT p.balance         FROM public.profiles p WHERE p.user_id = auth.uid())
    AND locked_balance  = (SELECT p.locked_balance  FROM public.profiles p WHERE p.user_id = auth.uid())
    AND bonus_balance   = (SELECT p.bonus_balance   FROM public.profiles p WHERE p.user_id = auth.uid())
    AND total_deposit   = (SELECT p.total_deposit   FROM public.profiles p WHERE p.user_id = auth.uid())
    AND total_withdraw  = (SELECT p.total_withdraw  FROM public.profiles p WHERE p.user_id = auth.uid())
    AND total_bet       = (SELECT p.total_bet       FROM public.profiles p WHERE p.user_id = auth.uid())
    AND total_win       = (SELECT p.total_win       FROM public.profiles p WHERE p.user_id = auth.uid())
    AND cashback_total  = (SELECT p.cashback_total  FROM public.profiles p WHERE p.user_id = auth.uid())
    AND kyc_status      = (SELECT p.kyc_status      FROM public.profiles p WHERE p.user_id = auth.uid())
    AND status          = (SELECT p.status          FROM public.profiles p WHERE p.user_id = auth.uid())
    AND referral_code   IS NOT DISTINCT FROM (SELECT p.referral_code FROM public.profiles p WHERE p.user_id = auth.uid())
    AND referred_by     IS NOT DISTINCT FROM (SELECT p.referred_by   FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- 7. place_bets: derive payout server-side from market.payouts, ignore client value
CREATE OR REPLACE FUNCTION public.place_bets(
  _market_id TEXT,
  _session_date DATE,
  _items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _market RECORD;
  _profile RECORD;
  _item JSONB;
  _total NUMERIC := 0;
  _amount NUMERIC;
  _bet_type TEXT;
  _bet_number TEXT;
  _session TEXT;
  _payout NUMERIC;
  _new_bet_id UUID;
  _bet_ids UUID[] := ARRAY[]::UUID[];
  _now_hhmm TEXT;
  _open_session_open BOOLEAN;
  _close_session_open BOOLEAN;
  _balance_before NUMERIC;
  _validation RECORD;
  _existing_result RECORD;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _market FROM public.markets WHERE id = _market_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MARKET_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF _market.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'MARKET_SUSPENDED' USING ERRCODE = 'P0001';
  END IF;

  _now_hhmm := to_char((now() AT TIME ZONE 'Asia/Kolkata')::time, 'HH24:MI');
  _open_session_open  := (_now_hhmm < _market.open_time)  AND (_session_date = (now() AT TIME ZONE 'Asia/Kolkata')::date);
  _close_session_open := (_now_hhmm < _market.close_time) AND (_session_date = (now() AT TIME ZONE 'Asia/Kolkata')::date);

  SELECT * INTO _existing_result FROM public.market_results
    WHERE market_id = _market_id AND session_date = _session_date;
  IF FOUND AND _existing_result.open_pana  IS NOT NULL THEN _open_session_open  := false; END IF;
  IF FOUND AND _existing_result.close_pana IS NOT NULL THEN _close_session_open := false; END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _session := _item->>'session';
    _bet_type := _item->>'bet_type';
    _bet_number := _item->>'bet_number';
    _amount := (_item->>'amount')::NUMERIC;

    IF _amount IS NULL OR _amount < _market.min_bet OR _amount > _market.max_bet THEN
      RAISE EXCEPTION 'INVALID_AMOUNT: %', _amount USING ERRCODE = 'P0001';
    END IF;

    IF _session = 'OPEN'  AND NOT _open_session_open  THEN RAISE EXCEPTION 'OPEN_SESSION_CLOSED'  USING ERRCODE = 'P0001'; END IF;
    IF _session = 'CLOSE' AND NOT _close_session_open THEN RAISE EXCEPTION 'CLOSE_SESSION_CLOSED' USING ERRCODE = 'P0001'; END IF;

    IF _bet_type IN ('SINGLE_OPEN','SINGLE_CLOSE') THEN
      IF _bet_number !~ '^[0-9]$' THEN RAISE EXCEPTION 'INVALID_DIGIT: %', _bet_number USING ERRCODE = 'P0001'; END IF;
    ELSIF _bet_type = 'JODI' THEN
      IF _bet_number !~ '^[0-9]{2}$' THEN RAISE EXCEPTION 'INVALID_JODI: %', _bet_number USING ERRCODE = 'P0001'; END IF;
    ELSIF _bet_type IN ('SINGLE_PANA','DOUBLE_PANA','TRIPLE_PANA') THEN
      SELECT * INTO _validation FROM public.validate_pana(_bet_number);
      IF NOT _validation.valid THEN RAISE EXCEPTION 'INVALID_PANA: %', _bet_number USING ERRCODE = 'P0001'; END IF;
      IF _bet_type = 'SINGLE_PANA' AND _validation.pana_type <> 'SINGLE' THEN RAISE EXCEPTION 'PANA_TYPE_MISMATCH' USING ERRCODE = 'P0001'; END IF;
      IF _bet_type = 'DOUBLE_PANA' AND _validation.pana_type <> 'DOUBLE' THEN RAISE EXCEPTION 'PANA_TYPE_MISMATCH' USING ERRCODE = 'P0001'; END IF;
      IF _bet_type = 'TRIPLE_PANA' AND _validation.pana_type <> 'TRIPLE' THEN RAISE EXCEPTION 'PANA_TYPE_MISMATCH' USING ERRCODE = 'P0001'; END IF;
    END IF;

    _total := _total + _amount;
  END LOOP;

  SELECT * INTO _profile FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF _profile.balance < _total THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %, need %', _profile.balance, _total USING ERRCODE = 'P0001';
  END IF;

  _balance_before := _profile.balance;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _bet_type := _item->>'bet_type';
    _amount := (_item->>'amount')::NUMERIC;

    -- Derive authoritative payout from market config; ignore client value
    _payout := CASE _bet_type
      WHEN 'SINGLE_OPEN'  THEN (_market.payouts->>'single')::NUMERIC
      WHEN 'SINGLE_CLOSE' THEN (_market.payouts->>'single')::NUMERIC
      WHEN 'JODI'         THEN (_market.payouts->>'jodi')::NUMERIC
      WHEN 'SINGLE_PANA'  THEN (_market.payouts->>'singlePana')::NUMERIC
      WHEN 'DOUBLE_PANA'  THEN (_market.payouts->>'doublePana')::NUMERIC
      WHEN 'TRIPLE_PANA'  THEN (_market.payouts->>'triplePana')::NUMERIC
      WHEN 'HALF_SANGAM'  THEN (_market.payouts->>'halfSangam')::NUMERIC
      WHEN 'FULL_SANGAM'  THEN (_market.payouts->>'fullSangam')::NUMERIC
      ELSE NULL
    END;

    IF _payout IS NULL OR _payout <= 0 THEN
      RAISE EXCEPTION 'INVALID_BET_TYPE: %', _bet_type USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.bets (user_id, market_id, session_date, session, bet_type, bet_number, amount, payout, status)
    VALUES (
      _user_id, _market_id, _session_date,
      _item->>'session', _bet_type, _item->>'bet_number',
      _amount, _payout, 'PENDING'
    )
    RETURNING id INTO _new_bet_id;

    _bet_ids := array_append(_bet_ids, _new_bet_id);

    INSERT INTO public.wallet_transactions
      (user_id, type, amount, balance_before, balance_after, status, description, reference_id)
    VALUES (
      _user_id, 'BET_PLACED', -_amount,
      _balance_before, _balance_before - _amount,
      'COMPLETED',
      _bet_type || ' ' || (_item->>'bet_number') || ' on ' || _market.display_name,
      _new_bet_id::TEXT
    );
    _balance_before := _balance_before - _amount;
  END LOOP;

  UPDATE public.profiles
  SET balance = balance - _total,
      total_bet = total_bet + _total
  WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'placedCount', array_length(_bet_ids, 1),
    'totalAmount', _total,
    'newBalance', _profile.balance - _total,
    'betIds', to_jsonb(_bet_ids)
  );
END;
$$;
