
CREATE OR REPLACE FUNCTION public.system_auto_declare(
  _market_id text, _session_date date, _session text, _pana text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _validation RECORD;
  _digit smallint;
  _result_row RECORD;
  _new_open_pana TEXT; _new_close_pana TEXT;
  _new_open_digit smallint; _new_close_digit smallint;
  _new_jodi TEXT;
  _bet RECORD;
  _winners INT := 0; _losers INT := 0;
  _payout_total NUMERIC := 0;
  _balance_before NUMERIC;
  _won BOOLEAN; _win_amount NUMERIC;
  _confirmed_sources INT;
BEGIN
  IF _session NOT IN ('OPEN','CLOSE') THEN
    RAISE EXCEPTION 'INVALID_SESSION';
  END IF;
  SELECT * INTO _validation FROM public.validate_pana(_pana);
  IF NOT _validation.valid THEN RAISE EXCEPTION 'INVALID_PANA: %', _pana; END IF;
  _digit := _validation.digit;

  -- SCRAPER-ONLY GUARD: refuse to publish unless a matching scrape observation exists.
  -- The scraper's record_observation_and_maybe_declare RPC writes the observation
  -- before calling this function, so the legitimate path always passes.
  SELECT COUNT(*) INTO _confirmed_sources
  FROM public.result_observations
  WHERE market_id = _market_id
    AND session_date = _session_date
    AND session = _session
    AND pana = _pana;
  IF _confirmed_sources < 1 THEN
    RAISE EXCEPTION 'SCRAPER_CONFIRMATION_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _result_row FROM public.market_results
    WHERE market_id = _market_id AND session_date = _session_date FOR UPDATE;

  IF NOT FOUND THEN
    IF _session = 'OPEN' THEN
      _new_open_pana := _pana; _new_open_digit := _digit;
    ELSE
      _new_close_pana := _pana; _new_close_digit := _digit;
    END IF;
    INSERT INTO public.market_results (market_id, session_date, open_pana, open_digit, close_pana, close_digit, status, declared_at)
    VALUES (_market_id, _session_date, _new_open_pana, _new_open_digit, _new_close_pana, _new_close_digit, 'DECLARED', now());
  ELSE
    IF _session = 'OPEN' AND _result_row.open_pana IS NOT NULL THEN RETURN jsonb_build_object('skipped','already_declared'); END IF;
    IF _session = 'CLOSE' AND _result_row.close_pana IS NOT NULL THEN RETURN jsonb_build_object('skipped','already_declared'); END IF;
    IF _session = 'OPEN' THEN
      _new_open_pana := _pana; _new_open_digit := _digit;
      _new_close_pana := _result_row.close_pana; _new_close_digit := _result_row.close_digit;
    ELSE
      _new_open_pana := _result_row.open_pana; _new_open_digit := _result_row.open_digit;
      _new_close_pana := _pana; _new_close_digit := _digit;
    END IF;
    IF _new_open_digit IS NOT NULL AND _new_close_digit IS NOT NULL THEN
      _new_jodi := _new_open_digit::TEXT || _new_close_digit::TEXT;
    END IF;
    UPDATE public.market_results
    SET open_pana=_new_open_pana, open_digit=_new_open_digit,
        close_pana=_new_close_pana, close_digit=_new_close_digit,
        jodi=_new_jodi, status='DECLARED', declared_at=now()
    WHERE market_id=_market_id AND session_date=_session_date;
  END IF;

  FOR _bet IN
    SELECT b.* FROM public.bets b
    WHERE b.market_id=_market_id AND b.session_date=_session_date AND b.status='PENDING'
      AND (
        (_session='OPEN' AND b.session='OPEN' AND b.bet_type IN ('SINGLE_OPEN','SINGLE_PANA','DOUBLE_PANA','TRIPLE_PANA'))
        OR (_session='CLOSE' AND b.session='CLOSE' AND b.bet_type IN ('SINGLE_CLOSE','SINGLE_PANA','DOUBLE_PANA','TRIPLE_PANA'))
        OR (_new_jodi IS NOT NULL AND b.bet_type IN ('JODI','HALF_SANGAM','FULL_SANGAM'))
      )
    FOR UPDATE
  LOOP
    _won := false; _win_amount := 0;
    IF _bet.bet_type='SINGLE_OPEN' THEN
      _won := _new_open_digit IS NOT NULL AND _bet.bet_number=_new_open_digit::TEXT;
    ELSIF _bet.bet_type='SINGLE_CLOSE' THEN
      _won := _new_close_digit IS NOT NULL AND _bet.bet_number=_new_close_digit::TEXT;
    ELSIF _bet.bet_type='JODI' THEN
      _won := _new_jodi IS NOT NULL AND _bet.bet_number=_new_jodi;
    ELSIF _bet.bet_type IN ('SINGLE_PANA','DOUBLE_PANA','TRIPLE_PANA') THEN
      IF _bet.session='OPEN' THEN _won := _new_open_pana IS NOT NULL AND _bet.bet_number=_new_open_pana;
      ELSE _won := _new_close_pana IS NOT NULL AND _bet.bet_number=_new_close_pana; END IF;
    ELSIF _bet.bet_type='HALF_SANGAM' THEN
      IF _new_open_digit IS NOT NULL AND _new_close_pana IS NOT NULL
         AND _bet.bet_number=_new_open_digit::TEXT||'-'||_new_close_pana THEN _won:=true;
      ELSIF _new_open_pana IS NOT NULL AND _new_close_digit IS NOT NULL
         AND _bet.bet_number=_new_open_pana||'-'||_new_close_digit::TEXT THEN _won:=true; END IF;
    ELSIF _bet.bet_type='FULL_SANGAM' THEN
      _won := _new_open_pana IS NOT NULL AND _new_close_pana IS NOT NULL
              AND _bet.bet_number=_new_open_pana||'-'||_new_close_pana;
    END IF;

    IF _won THEN
      _win_amount := round(_bet.amount*_bet.payout, 2);
      _winners := _winners+1; _payout_total := _payout_total+_win_amount;
      UPDATE public.bets SET status='WON', win_amount=_win_amount, settled_at=now() WHERE id=_bet.id;
      SELECT balance INTO _balance_before FROM public.profiles WHERE user_id=_bet.user_id FOR UPDATE;
      INSERT INTO public.wallet_transactions
        (user_id,type,amount,balance_before,balance_after,status,description,reference_id)
      VALUES (_bet.user_id,'BET_WIN',_win_amount,_balance_before,_balance_before+_win_amount,
              'COMPLETED','Win (scraper): '||_bet.bet_type||' '||_bet.bet_number,_bet.id::TEXT);
      UPDATE public.profiles SET balance=balance+_win_amount, total_win=total_win+_win_amount WHERE user_id=_bet.user_id;
    ELSE
      _losers := _losers+1;
      UPDATE public.bets SET status='LOST', settled_at=now() WHERE id=_bet.id;
    END IF;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, actor_email, action, market_id, session_date, session, pana, reason, metadata)
  VALUES (NULL, 'system@auto', 'AUTO_DECLARE', _market_id, _session_date, _session, _pana, 'scraper-confirmed',
          jsonb_build_object('winners',_winners,'losers',_losers,'payout',_payout_total,'digit',_digit));

  RETURN jsonb_build_object('success',true,'pana',_pana,'digit',_digit,'jodi',_new_jodi,
                            'winners',_winners,'losers',_losers,'payout',_payout_total);
END $$;

REVOKE EXECUTE ON FUNCTION public.system_auto_declare(text, date, text, text) FROM PUBLIC, anon, authenticated;
