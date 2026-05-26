CREATE OR REPLACE FUNCTION public.place_bets(_market_id text, _session_date date, _items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Only let an existing result close a session AFTER its cutoff has passed,
  -- so a prematurely-scraped result can't block bets while the slot is still open.
  IF FOUND AND _existing_result.open_pana  IS NOT NULL AND _now_hhmm >= _market.open_time  THEN _open_session_open  := false; END IF;
  IF FOUND AND _existing_result.close_pana IS NOT NULL AND _now_hhmm >= _market.close_time THEN _close_session_open := false; END IF;

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
      SELECT * INTO _validation FROM public.pana_chart WHERE pana = _bet_number;
      IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_PANA: %', _bet_number USING ERRCODE = 'P0001'; END IF;
      IF (_bet_type = 'SINGLE_PANA' AND _validation.pana_type <> 'SINGLE')
        OR (_bet_type = 'DOUBLE_PANA' AND _validation.pana_type <> 'DOUBLE')
        OR (_bet_type = 'TRIPLE_PANA' AND _validation.pana_type <> 'TRIPLE') THEN
        RAISE EXCEPTION 'PANA_TYPE_MISMATCH' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    _total := _total + _amount;
  END LOOP;

  SELECT * INTO _profile FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF _profile.balance < _total THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001'; END IF;
  _balance_before := _profile.balance;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _session := _item->>'session';
    _bet_type := _item->>'bet_type';
    _bet_number := _item->>'bet_number';
    _amount := (_item->>'amount')::NUMERIC;
    _payout := (_item->>'payout')::NUMERIC;

    INSERT INTO public.bets (user_id, market_id, session_date, session, bet_type, bet_number, amount, payout, status)
    VALUES (_user_id, _market_id, _session_date, _session, _bet_type, _bet_number, _amount, _payout, 'PENDING')
    RETURNING id INTO _new_bet_id;
    _bet_ids := _bet_ids || _new_bet_id;
  END LOOP;

  UPDATE public.profiles
     SET balance = balance - _total,
         total_bet = total_bet + _total,
         updated_at = now()
   WHERE user_id = _user_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_before, balance_after, status, description)
  VALUES (_user_id, 'BET_PLACED', _total, _balance_before, _balance_before - _total, 'COMPLETED', format('Placed %s bets on %s', array_length(_bet_ids,1), _market.display_name));

  RETURN jsonb_build_object(
    'placedCount', array_length(_bet_ids, 1),
    'totalAmount', _total,
    'newBalance', _balance_before - _total,
    'betIds', to_jsonb(_bet_ids)
  );
END;
$function$;