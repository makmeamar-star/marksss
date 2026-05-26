CREATE OR REPLACE FUNCTION public.admin_override_result(
  _market_id text,
  _session_date date,
  _session text,
  _new_pana text,
  _reason text,
  _confirm text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _is_admin BOOLEAN;
  _validation RECORD;
  _digit SMALLINT;
  _result_row RECORD;
  _previous_pana TEXT;
  _bet RECORD;
  _balance_before NUMERIC;
  _new_open_pana TEXT;
  _new_close_pana TEXT;
  _new_open_digit SMALLINT;
  _new_close_digit SMALLINT;
  _new_jodi TEXT;
  _winners INT := 0;
  _losers INT := 0;
  _payout_total NUMERIC := 0;
  _refunded_total NUMERIC := 0;
  _won BOOLEAN;
  _win_amount NUMERIC;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT public.has_role(_user_id, 'admin') INTO _is_admin;
  IF NOT _is_admin THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501'; END IF;

  IF _confirm IS DISTINCT FROM 'I_UNDERSTAND_THIS_RESETTLES' THEN
    RAISE EXCEPTION 'CONFIRMATION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 20 THEN
    RAISE EXCEPTION 'REASON_TOO_SHORT' USING ERRCODE = 'P0001';
  END IF;
  IF _session NOT IN ('OPEN','CLOSE') THEN
    RAISE EXCEPTION 'INVALID_SESSION' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _validation FROM public.validate_pana(_new_pana);
  IF NOT _validation.valid THEN RAISE EXCEPTION 'INVALID_PANA: %', _new_pana USING ERRCODE = 'P0001'; END IF;
  _digit := _validation.digit;

  SELECT * INTO _result_row FROM public.market_results
    WHERE market_id = _market_id AND session_date = _session_date FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESULT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  IF _session = 'OPEN' THEN
    _previous_pana := _result_row.open_pana;
  ELSE
    _previous_pana := _result_row.close_pana;
  END IF;
  IF _previous_pana IS NULL THEN
    RAISE EXCEPTION 'SESSION_NOT_DECLARED' USING ERRCODE = 'P0001';
  END IF;

  -- Reverse settled bets touching this session: refund wins, even into negative balance
  FOR _bet IN
    SELECT b.* FROM public.bets b
    WHERE b.market_id = _market_id AND b.session_date = _session_date
      AND b.status IN ('WON','LOST')
    FOR UPDATE
  LOOP
    IF _bet.status = 'WON' AND _bet.win_amount IS NOT NULL THEN
      SELECT balance INTO _balance_before FROM public.profiles WHERE user_id = _bet.user_id FOR UPDATE;
      INSERT INTO public.wallet_transactions
        (user_id, type, amount, balance_before, balance_after, status, description, reference_id)
      VALUES (_bet.user_id, 'CORRECTION_REVERSAL', -(_bet.win_amount), _balance_before, _balance_before - _bet.win_amount,
              'COMPLETED', 'Reversal (override): ' || _bet.bet_type || ' ' || _bet.bet_number, _bet.id::TEXT);
      UPDATE public.profiles SET balance = balance - _bet.win_amount,
                                  total_win = greatest(0, total_win - _bet.win_amount)
        WHERE user_id = _bet.user_id;
      _refunded_total := _refunded_total + _bet.win_amount;
    END IF;
    UPDATE public.bets SET status = 'PENDING', win_amount = NULL, settled_at = NULL WHERE id = _bet.id;
  END LOOP;

  -- Apply new pana
  IF _session = 'OPEN' THEN
    _new_open_pana := _new_pana; _new_open_digit := _digit;
    _new_close_pana := _result_row.close_pana; _new_close_digit := _result_row.close_digit;
  ELSE
    _new_open_pana := _result_row.open_pana; _new_open_digit := _result_row.open_digit;
    _new_close_pana := _new_pana; _new_close_digit := _digit;
  END IF;
  IF _new_open_digit IS NOT NULL AND _new_close_digit IS NOT NULL THEN
    _new_jodi := _new_open_digit::TEXT || _new_close_digit::TEXT;
  END IF;
  UPDATE public.market_results
  SET open_pana = _new_open_pana, open_digit = _new_open_digit,
      close_pana = _new_close_pana, close_digit = _new_close_digit,
      jodi = _new_jodi, declared_at = now(), declared_by = _user_id
  WHERE market_id = _market_id AND session_date = _session_date;

  -- Re-settle
  FOR _bet IN
    SELECT b.* FROM public.bets b
    WHERE b.market_id = _market_id AND b.session_date = _session_date AND b.status = 'PENDING'
    FOR UPDATE
  LOOP
    _won := false; _win_amount := 0;
    IF _bet.bet_type = 'SINGLE_OPEN' THEN
      _won := _new_open_digit IS NOT NULL AND _bet.bet_number = _new_open_digit::TEXT;
    ELSIF _bet.bet_type = 'SINGLE_CLOSE' THEN
      _won := _new_close_digit IS NOT NULL AND _bet.bet_number = _new_close_digit::TEXT;
    ELSIF _bet.bet_type = 'JODI' THEN
      _won := _new_jodi IS NOT NULL AND _bet.bet_number = _new_jodi;
    ELSIF _bet.bet_type IN ('SINGLE_PANA','DOUBLE_PANA','TRIPLE_PANA') THEN
      IF _bet.session = 'OPEN' THEN
        _won := _new_open_pana IS NOT NULL AND _bet.bet_number = _new_open_pana;
      ELSE
        _won := _new_close_pana IS NOT NULL AND _bet.bet_number = _new_close_pana;
      END IF;
    ELSIF _bet.bet_type = 'HALF_SANGAM' THEN
      _won := (_new_open_digit IS NOT NULL AND _new_close_pana IS NOT NULL
               AND _bet.bet_number = _new_open_digit::TEXT || '-' || _new_close_pana)
           OR (_new_close_digit IS NOT NULL AND _new_open_pana IS NOT NULL
               AND _bet.bet_number = _new_open_pana || '-' || _new_close_digit::TEXT);
    ELSIF _bet.bet_type = 'FULL_SANGAM' THEN
      _won := _new_open_pana IS NOT NULL AND _new_close_pana IS NOT NULL
              AND _bet.bet_number = _new_open_pana || '-' || _new_close_pana;
    END IF;

    IF _won THEN
      _win_amount := round(_bet.amount * _bet.payout, 2);
      _winners := _winners + 1; _payout_total := _payout_total + _win_amount;
      UPDATE public.bets SET status = 'WON', win_amount = _win_amount, settled_at = now() WHERE id = _bet.id;
      SELECT balance INTO _balance_before FROM public.profiles WHERE user_id = _bet.user_id FOR UPDATE;
      INSERT INTO public.wallet_transactions
        (user_id, type, amount, balance_before, balance_after, status, description, reference_id)
      VALUES (_bet.user_id, 'BET_WIN', _win_amount, _balance_before, _balance_before + _win_amount,
              'COMPLETED', 'Win (override): ' || _bet.bet_type || ' ' || _bet.bet_number, _bet.id::TEXT);
      UPDATE public.profiles SET balance = balance + _win_amount,
                                  total_win = total_win + _win_amount WHERE user_id = _bet.user_id;
    ELSE
      _losers := _losers + 1;
      UPDATE public.bets SET status = 'LOST', settled_at = now() WHERE id = _bet.id;
    END IF;
  END LOOP;

  -- Audit
  INSERT INTO public.audit_log (actor_id, actor_email, action, market_id, session_date, session, pana, previous_pana, reason, metadata)
  VALUES (_user_id, (SELECT email FROM auth.users WHERE id = _user_id),
          'ADMIN_HARD_OVERRIDE', _market_id, _session_date, _session, _new_pana, _previous_pana, _reason,
          jsonb_build_object(
            'override', true,
            'winners', _winners,
            'losers', _losers,
            'new_payout', _payout_total,
            'refunded', _refunded_total,
            'payout_delta', _payout_total - _refunded_total,
            'digit', _digit
          ));

  -- Alert
  INSERT INTO public.system_alerts (source, severity, title, message, context)
  VALUES (
    'admin_override',
    'warning',
    'Hard override applied: ' || _market_id || ' (' || _session || ')',
    'Admin changed ' || _previous_pana || ' → ' || _new_pana || '. ' ||
      _winners || ' new winners, refunded ' || _refunded_total || ', new payout ' || _payout_total || '.',
    jsonb_build_object(
      'market_id', _market_id,
      'session_date', _session_date,
      'session', _session,
      'actor_id', _user_id,
      'reason', _reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'pana', _new_pana,
    'previousPana', _previous_pana,
    'digit', _digit,
    'jodi', _new_jodi,
    'winners', _winners,
    'losers', _losers,
    'newPayout', _payout_total,
    'refunded', _refunded_total,
    'payoutDelta', _payout_total - _refunded_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_override_result(text, date, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_override_result(text, date, text, text, text, text) TO authenticated;