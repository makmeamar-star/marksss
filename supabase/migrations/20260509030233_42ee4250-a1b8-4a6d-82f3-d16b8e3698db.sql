
-- 1. Automation config per market
CREATE TABLE public.market_automation (
  market_id text PRIMARY KEY REFERENCES public.markets(id) ON DELETE CASCADE,
  open_enabled boolean NOT NULL DEFAULT false,
  close_enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'RANDOM',
  grace_minutes int NOT NULL DEFAULT 1,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_automation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads automation"
ON public.market_automation FOR SELECT TO public USING (true);

CREATE POLICY "Admins manage automation"
ON public.market_automation FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER market_automation_touch
BEFORE UPDATE ON public.market_automation
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed rows for existing markets
INSERT INTO public.market_automation (market_id)
SELECT id FROM public.markets ON CONFLICT DO NOTHING;

-- 2. System auto-declare function (no admin check; called by cron security definer)
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
BEGIN
  IF _session NOT IN ('OPEN','CLOSE') THEN
    RAISE EXCEPTION 'INVALID_SESSION';
  END IF;
  SELECT * INTO _validation FROM public.validate_pana(_pana);
  IF NOT _validation.valid THEN RAISE EXCEPTION 'INVALID_PANA: %', _pana; END IF;
  _digit := _validation.digit;

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

  -- Settle pending bets (same logic as declare_result)
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
              'COMPLETED','Win (auto): '||_bet.bet_type||' '||_bet.bet_number,_bet.id::TEXT);
      UPDATE public.profiles SET balance=balance+_win_amount, total_win=total_win+_win_amount WHERE user_id=_bet.user_id;
    ELSE
      _losers := _losers+1;
      UPDATE public.bets SET status='LOST', settled_at=now() WHERE id=_bet.id;
    END IF;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, actor_email, action, market_id, session_date, session, pana, reason, metadata)
  VALUES (NULL, 'system@auto', 'AUTO_DECLARE', _market_id, _session_date, _session, _pana, 'scheduler',
          jsonb_build_object('winners',_winners,'losers',_losers,'payout',_payout_total,'digit',_digit));

  RETURN jsonb_build_object('success',true,'pana',_pana,'digit',_digit,'jodi',_new_jodi,
                            'winners',_winners,'losers',_losers,'payout',_payout_total);
END $$;

-- 3. Scheduler: run all due automations
CREATE OR REPLACE FUNCTION public.run_due_auto_declarations()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _now_ist timestamptz := now() AT TIME ZONE 'Asia/Kolkata';
  _today date := (_now_ist)::date;
  _now_time time := (_now_ist)::time;
  _m RECORD;
  _existing RECORD;
  _pana TEXT;
  _ran INT := 0;
  _results jsonb := '[]'::jsonb;
  _r jsonb;
BEGIN
  FOR _m IN
    SELECT mk.id, mk.open_time::time AS open_t, mk.close_time::time AS close_t,
           a.open_enabled, a.close_enabled, a.grace_minutes, a.mode
    FROM public.markets mk
    JOIN public.market_automation a ON a.market_id = mk.id
    WHERE mk.status='ACTIVE' AND (a.open_enabled OR a.close_enabled)
  LOOP
    SELECT * INTO _existing FROM public.market_results
      WHERE market_id=_m.id AND session_date=_today;

    -- OPEN session
    IF _m.open_enabled AND _now_time >= (_m.open_t + (_m.grace_minutes || ' minutes')::interval)
       AND (_existing.open_pana IS NULL OR _existing IS NULL) THEN
      SELECT pana INTO _pana FROM public.pana_chart ORDER BY random() LIMIT 1;
      _r := public.system_auto_declare(_m.id, _today, 'OPEN', _pana);
      _results := _results || jsonb_build_object('market',_m.id,'session','OPEN','pana',_pana,'result',_r);
      _ran := _ran+1;
    END IF;

    -- CLOSE session
    IF _m.close_enabled AND _now_time >= (_m.close_t + (_m.grace_minutes || ' minutes')::interval)
       AND (_existing.close_pana IS NULL OR _existing IS NULL) THEN
      SELECT pana INTO _pana FROM public.pana_chart ORDER BY random() LIMIT 1;
      _r := public.system_auto_declare(_m.id, _today, 'CLOSE', _pana);
      _results := _results || jsonb_build_object('market',_m.id,'session','CLOSE','pana',_pana,'result',_r);
      _ran := _ran+1;
    END IF;

    UPDATE public.market_automation SET last_run_at=now() WHERE market_id=_m.id;
  END LOOP;

  RETURN jsonb_build_object('ran',_ran,'at',now(),'details',_results);
END $$;

GRANT EXECUTE ON FUNCTION public.run_due_auto_declarations() TO anon, authenticated, service_role;
