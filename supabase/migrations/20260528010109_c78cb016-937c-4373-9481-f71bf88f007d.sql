
-- ============================================================
-- 1) Withdrawal request status: allow APPROVED, PAID, DECLINED
-- ============================================================
ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_status_check
  CHECK (status IN ('PENDING','APPROVED','PROCESSING','PAID','COMPLETED','REJECTED','DECLINED'));

-- ============================================================
-- 2) Decline withdrawal (alias of reject, status = 'DECLINED')
-- ============================================================
CREATE OR REPLACE FUNCTION public.decline_withdrawal(_request_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _admin UUID := auth.uid(); _req RECORD;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='P0001'; END IF;

  SELECT * INTO _req FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF _req.status <> 'PENDING' THEN RAISE EXCEPTION 'ALREADY_PROCESSED' USING ERRCODE='P0001'; END IF;

  UPDATE public.withdrawal_requests
     SET status='DECLINED', processed_at=now(), processed_by=_admin, reject_reason=_reason
   WHERE id=_request_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (_req.user_id, 'withdraw_declined',
          'Withdrawal declined',
          'Your ₹' || _req.amount::TEXT || ' withdrawal was declined: ' || _reason,
          '/wallet',
          jsonb_build_object('request_id', _req.id, 'reason', _reason));

  INSERT INTO public.audit_log (actor_id, actor_email, action, reason, metadata)
  VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin), 'DECLINE_WITHDRAWAL', _reason,
          jsonb_build_object('request_id', _req.id, 'amount', _req.amount, 'user_id', _req.user_id));

  RETURN jsonb_build_object('success', true);
END $$;

GRANT EXECUTE ON FUNCTION public.decline_withdrawal(UUID, TEXT) TO authenticated;

-- ============================================================
-- 3) Mark withdrawal paid (APPROVED -> PAID)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_withdrawal_paid(_request_id UUID, _note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _admin UUID := auth.uid(); _req RECORD;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;

  SELECT * INTO _req FROM public.withdrawal_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF _req.status NOT IN ('APPROVED','PROCESSING') THEN
    RAISE EXCEPTION 'NOT_APPROVED' USING ERRCODE='P0001';
  END IF;

  UPDATE public.withdrawal_requests
     SET status='PAID', processed_at=now(), processed_by=_admin
   WHERE id=_request_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (_req.user_id, 'withdraw_paid',
          'Withdrawal paid',
          '₹' || _req.amount::TEXT || ' has been paid out to your account.',
          '/wallet',
          jsonb_build_object('request_id', _req.id, 'note', _note));

  INSERT INTO public.audit_log (actor_id, actor_email, action, metadata)
  VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin), 'MARK_WITHDRAWAL_PAID',
          jsonb_build_object('request_id', _req.id, 'amount', _req.amount, 'user_id', _req.user_id, 'note', _note));

  RETURN jsonb_build_object('success', true);
END $$;

GRANT EXECUTE ON FUNCTION public.mark_withdrawal_paid(UUID, TEXT) TO authenticated;

-- ============================================================
-- 4) Allow JODI session in result_observations
-- ============================================================
ALTER TABLE public.result_observations DROP CONSTRAINT IF EXISTS result_observations_session_check;
ALTER TABLE public.result_observations
  ADD CONSTRAINT result_observations_session_check
  CHECK (session IN ('OPEN','CLOSE','JODI'));

-- ============================================================
-- 5) Tighten auto-declare confirmation threshold to 2 sources
-- ============================================================
INSERT INTO public.app_settings(key, value, updated_at)
VALUES ('auto_declare_min_confirmations', to_jsonb(2), now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Patch the RPC: enforce a hard floor of 2 (was 1).
CREATE OR REPLACE FUNCTION public.record_observation_and_maybe_declare(
  _market_id text, _session_date date, _session text, _source text, _pana text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _min_conf int;
  _conf_count int;
  _conflicting_count int;
  _existing_result text;
  _declare_result jsonb;
BEGIN
  SELECT COALESCE((value)::text::int, 2) INTO _min_conf
    FROM app_settings WHERE key = 'auto_declare_min_confirmations';
  IF _min_conf IS NULL OR _min_conf < 2 THEN _min_conf := 2; END IF;

  SELECT CASE WHEN _session = 'OPEN' THEN open_pana ELSE close_pana END
    INTO _existing_result
    FROM market_results
   WHERE market_id = _market_id AND session_date = _session_date;
  IF _existing_result IS NOT NULL THEN
    RETURN jsonb_build_object('status','SKIPPED_DECLARED');
  END IF;

  INSERT INTO result_observations (market_id, session_date, session, source, pana)
  VALUES (_market_id, _session_date, _session, _source, _pana)
  ON CONFLICT (market_id, session_date, session, source, pana)
  DO UPDATE SET last_seen_at = now(), seen_count = result_observations.seen_count + 1;

  SELECT COUNT(*) INTO _conflicting_count
    FROM result_observations
   WHERE market_id = _market_id AND session_date = _session_date
     AND session = _session AND pana <> _pana;

  IF _conflicting_count > 0 THEN
    INSERT INTO system_alerts (severity, source, title, message, context)
    VALUES (
      'warning','scraper-mismatch','Scraper saw conflicting panas',
      format('%s %s: source %s reported %s but earlier observations differ', _market_id, _session, _source, _pana),
      jsonb_build_object('market_id', _market_id, 'session_date', _session_date, 'session', _session, 'pana', _pana, 'source', _source)
    );
    RETURN jsonb_build_object('status','MISMATCH');
  END IF;

  SELECT COUNT(DISTINCT source) INTO _conf_count
    FROM result_observations
   WHERE market_id = _market_id AND session_date = _session_date
     AND session = _session AND pana = _pana;

  IF _conf_count >= _min_conf THEN
    SELECT system_auto_declare(_market_id, _session_date, _session, _pana) INTO _declare_result;
    RETURN jsonb_build_object('status','DECLARED','declare', _declare_result, 'confirmations', _conf_count);
  END IF;

  RETURN jsonb_build_object('status','AWAITING_CONFIRMATION','confirmations', _conf_count, 'needed', _min_conf);
END;
$$;

-- ============================================================
-- 6) Admin JODI override (mirrors admin_override_result for jodi-only markets)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_override_result_jodi(
  _market_id text, _session_date date, _new_jodi text, _reason text, _confirm text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _result_row RECORD;
  _previous_jodi TEXT;
  _open_digit smallint;
  _close_digit smallint;
  _bet RECORD;
  _balance_before NUMERIC;
  _payouts jsonb;
  _mult numeric;
  _won boolean;
  _winners int := 0;
  _losers int := 0;
  _payout_total numeric := 0;
  _refunded_total numeric := 0;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_user_id, 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  IF _confirm IS DISTINCT FROM 'I_UNDERSTAND_THIS_RESETTLES' THEN
    RAISE EXCEPTION 'CONFIRMATION_REQUIRED' USING ERRCODE='P0001';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 20 THEN
    RAISE EXCEPTION 'REASON_TOO_SHORT' USING ERRCODE='P0001';
  END IF;
  IF _new_jodi !~ '^[0-9]{2}$' THEN
    RAISE EXCEPTION 'INVALID_JODI' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO _result_row FROM public.market_results
    WHERE market_id = _market_id AND session_date = _session_date FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESULT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  _previous_jodi := _result_row.jodi;
  IF _previous_jodi IS NULL THEN
    RAISE EXCEPTION 'JODI_NOT_DECLARED' USING ERRCODE='P0001';
  END IF;

  _open_digit  := substring(_new_jodi from 1 for 1)::smallint;
  _close_digit := substring(_new_jodi from 2 for 1)::smallint;

  -- Reverse settled bets
  FOR _bet IN
    SELECT b.* FROM public.bets b
     WHERE b.market_id = _market_id AND b.session_date = _session_date
       AND b.status IN ('WON','LOST') FOR UPDATE
  LOOP
    IF _bet.status = 'WON' AND _bet.win_amount IS NOT NULL THEN
      SELECT balance INTO _balance_before FROM public.profiles WHERE user_id = _bet.user_id FOR UPDATE;
      INSERT INTO public.wallet_transactions
        (user_id,type,amount,balance_before,balance_after,status,description,reference_id)
      VALUES (_bet.user_id,'CORRECTION_REVERSAL',-(_bet.win_amount),_balance_before,_balance_before - _bet.win_amount,
              'COMPLETED','Reversal (jodi override): ' || _bet.bet_type || ' ' || _bet.bet_number, _bet.id::TEXT);
      UPDATE public.profiles SET balance = balance - _bet.win_amount,
                                  total_win = greatest(0, total_win - _bet.win_amount)
        WHERE user_id = _bet.user_id;
      _refunded_total := _refunded_total + _bet.win_amount;
    END IF;
    UPDATE public.bets SET status='PENDING', win_amount=NULL, settled_at=NULL WHERE id=_bet.id;
  END LOOP;

  -- Apply new jodi
  UPDATE public.market_results
     SET open_digit=_open_digit, close_digit=_close_digit, jodi=_new_jodi,
         declared_at=now(), declared_by=_user_id, status='DECLARED'
   WHERE market_id=_market_id AND session_date=_session_date;

  SELECT payouts INTO _payouts FROM markets WHERE id = _market_id;

  -- Re-settle pending jodi/single bets
  FOR _bet IN
    SELECT * FROM public.bets
     WHERE market_id=_market_id AND session_date=_session_date AND status='PENDING'
       AND bet_type IN ('JODI','SINGLE','SINGLE_OPEN','SINGLE_CLOSE')
     FOR UPDATE
  LOOP
    IF _bet.bet_type='JODI' THEN
      _won := _bet.bet_number = _new_jodi;
      _mult := COALESCE((_payouts->>'jodi')::numeric, COALESCE(_bet.payout, 90));
    ELSIF _bet.bet_type='SINGLE_OPEN' THEN
      _won := _bet.bet_number = _open_digit::text;
      _mult := COALESCE(_bet.payout, (_payouts->>'single')::numeric, 9);
    ELSIF _bet.bet_type='SINGLE_CLOSE' THEN
      _won := _bet.bet_number = _close_digit::text;
      _mult := COALESCE(_bet.payout, (_payouts->>'single')::numeric, 9);
    ELSE
      _won := _bet.bet_number IN (_open_digit::text, _close_digit::text);
      _mult := COALESCE((_payouts->>'single')::numeric, 9);
    END IF;

    IF _won THEN
      SELECT balance INTO _balance_before FROM public.profiles WHERE user_id=_bet.user_id FOR UPDATE;
      UPDATE public.bets SET status='WON', win_amount=round(_bet.amount*_mult,2), settled_at=now() WHERE id=_bet.id;
      INSERT INTO public.wallet_transactions
        (user_id,type,amount,balance_before,balance_after,status,description,reference_id)
      VALUES (_bet.user_id,'BET_WIN',round(_bet.amount*_mult,2),_balance_before,_balance_before + round(_bet.amount*_mult,2),
              'COMPLETED','Win (jodi override): ' || _bet.bet_type || ' ' || _bet.bet_number, _bet.id::TEXT);
      UPDATE public.profiles
         SET balance = balance + round(_bet.amount*_mult,2),
             total_win = total_win + round(_bet.amount*_mult,2)
       WHERE user_id = _bet.user_id;
      _winners := _winners + 1; _payout_total := _payout_total + round(_bet.amount*_mult,2);
    ELSE
      UPDATE public.bets SET status='LOST', win_amount=0, settled_at=now() WHERE id=_bet.id;
      _losers := _losers + 1;
    END IF;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, actor_email, action, market_id, session_date, session, pana, previous_pana, reason, metadata)
  VALUES (_user_id, (SELECT email FROM auth.users WHERE id=_user_id), 'ADMIN_OVERRIDE_JODI',
          _market_id, _session_date, 'JODI', _new_jodi, _previous_jodi, _reason,
          jsonb_build_object('winners',_winners,'losers',_losers,'payout',_payout_total,'refunded',_refunded_total));

  INSERT INTO public.system_alerts (severity, source, title, message, context)
  VALUES ('warning','admin-override','Admin overrode jodi result',
          format('%s %s: %s -> %s', _market_id, _session_date, _previous_jodi, _new_jodi),
          jsonb_build_object('market_id',_market_id,'session_date',_session_date,'previous',_previous_jodi,'new',_new_jodi,'reason',_reason));

  RETURN jsonb_build_object(
    'success', true, 'previous', _previous_jodi, 'new', _new_jodi,
    'winners', _winners, 'losers', _losers, 'newPayout', _payout_total,
    'refunded', _refunded_total, 'payoutDelta', _payout_total - _refunded_total
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_override_result_jodi(text,date,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_override_result_jodi(text,date,text,text,text) TO authenticated;
