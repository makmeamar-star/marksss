
-- Profile wallet split
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_total NUMERIC NOT NULL DEFAULT 0;

-- Withdrawal SLA
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_withdrawal_sla()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at := NEW.created_at + interval '4 hours';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_withdrawal_sla ON public.withdrawal_requests;
CREATE TRIGGER trg_set_withdrawal_sla
BEFORE INSERT ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.set_withdrawal_sla();

-- Deposit auto-verify
ALTER TABLE public.deposit_requests
  ADD COLUMN IF NOT EXISTS auto_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expected_payee TEXT;

-- Promo codes catalog
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  bonus_amount NUMERIC NOT NULL CHECK (bonus_amount > 0),
  min_deposit NUMERIC NOT NULL DEFAULT 0,
  max_redemptions INT,
  redemptions_count INT NOT NULL DEFAULT 0,
  per_user_limit INT NOT NULL DEFAULT 1,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage promo codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone reads active promo codes" ON public.promo_codes
  FOR SELECT TO authenticated
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE TRIGGER promo_codes_touch BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Redemptions log
CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  promo_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  bonus_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promo_redemp_user ON public.promo_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemp_promo ON public.promo_redemptions(promo_id);
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own redemptions" ON public.promo_redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all redemptions" ON public.promo_redemptions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Cashback runs log
CREATE TABLE IF NOT EXISTS public.cashback_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID NOT NULL,
  loss_amount NUMERIC NOT NULL,
  cashback_amount NUMERIC NOT NULL,
  rate NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_date, user_id)
);
ALTER TABLE public.cashback_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own cashback" ON public.cashback_runs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all cashback" ON public.cashback_runs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Redeem promo code
CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  p public.promo_codes%ROWTYPE;
  used INT;
  bal_before NUMERIC;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN RAISE EXCEPTION 'CODE_REQUIRED' USING ERRCODE='P0001'; END IF;

  SELECT * INTO p FROM public.promo_codes
   WHERE code = upper(trim(_code)) AND active = true
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_CODE' USING ERRCODE='P0001'; END IF;
  IF p.expires_at IS NOT NULL AND p.expires_at <= now() THEN RAISE EXCEPTION 'CODE_EXPIRED' USING ERRCODE='P0001'; END IF;
  IF p.starts_at > now() THEN RAISE EXCEPTION 'CODE_NOT_YET_ACTIVE' USING ERRCODE='P0001'; END IF;
  IF p.max_redemptions IS NOT NULL AND p.redemptions_count >= p.max_redemptions THEN
    RAISE EXCEPTION 'CODE_FULLY_REDEEMED' USING ERRCODE='P0001';
  END IF;

  SELECT count(*) INTO used FROM public.promo_redemptions
   WHERE user_id = uid AND promo_id = p.id;
  IF used >= p.per_user_limit THEN RAISE EXCEPTION 'ALREADY_REDEEMED' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.promo_redemptions(user_id, promo_id, code, bonus_amount)
  VALUES (uid, p.id, p.code, p.bonus_amount);

  UPDATE public.promo_codes SET redemptions_count = redemptions_count + 1, updated_at = now()
   WHERE id = p.id;

  SELECT balance INTO bal_before FROM public.profiles WHERE user_id = uid FOR UPDATE;
  UPDATE public.profiles
     SET bonus_balance = bonus_balance + p.bonus_amount,
         balance = balance + p.bonus_amount,
         updated_at = now()
   WHERE user_id = uid;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_before, balance_after, status, description)
  VALUES (uid, 'BONUS', p.bonus_amount, bal_before, bal_before + p.bonus_amount, 'COMPLETED',
          'Promo code redeemed: ' || p.code);

  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (uid, 'promo_redeemed', 'Bonus credited',
          '₹' || p.bonus_amount::TEXT || ' bonus added for code ' || p.code, '/wallet');

  RETURN jsonb_build_object('ok', true, 'bonus', p.bonus_amount, 'code', p.code);
END $$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT) TO authenticated;

-- Cashback job
CREATE OR REPLACE FUNCTION public.run_daily_cashback(_rate NUMERIC DEFAULT 0.05)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yday DATE := CURRENT_DATE - 1;
  r RECORD;
  cb NUMERIC;
  bal_before NUMERIC;
  paid_count INT := 0;
  paid_total NUMERIC := 0;
BEGIN
  FOR r IN
    SELECT b.user_id,
           SUM(b.amount) AS staked,
           COALESCE(SUM(b.win_amount),0) AS won
      FROM public.bets b
     WHERE b.session_date = yday
       AND b.status IN ('WON','LOST')
     GROUP BY b.user_id
     HAVING SUM(b.amount) - COALESCE(SUM(b.win_amount),0) > 0
  LOOP
    cb := round((r.staked - r.won) * _rate, 2);
    IF cb < 1 THEN CONTINUE; END IF;
    BEGIN
      INSERT INTO public.cashback_runs(run_date, user_id, loss_amount, cashback_amount, rate)
      VALUES (yday, r.user_id, r.staked - r.won, cb, _rate);
    EXCEPTION WHEN unique_violation THEN CONTINUE;
    END;

    SELECT balance INTO bal_before FROM public.profiles WHERE user_id = r.user_id FOR UPDATE;
    UPDATE public.profiles
       SET balance = balance + cb,
           bonus_balance = bonus_balance + cb,
           cashback_total = cashback_total + cb,
           updated_at = now()
     WHERE user_id = r.user_id;

    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_before, balance_after, status, description)
    VALUES (r.user_id, 'BONUS', cb, bal_before, bal_before + cb, 'COMPLETED',
            'Daily cashback ' || _rate*100 || '% on ' || yday::TEXT);

    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (r.user_id, 'cashback', 'Cashback credited',
            '₹' || cb::TEXT || ' cashback for ' || yday::TEXT, '/wallet');

    paid_count := paid_count + 1;
    paid_total := paid_total + cb;
  END LOOP;

  INSERT INTO public.audit_log(actor_id, actor_email, action, metadata)
  VALUES (NULL, 'system@cashback', 'CASHBACK_RUN',
          jsonb_build_object('date', yday, 'count', paid_count, 'total', paid_total, 'rate', _rate));

  RETURN jsonb_build_object('ok', true, 'paid_count', paid_count, 'paid_total', paid_total, 'date', yday);
END $$;

REVOKE ALL ON FUNCTION public.run_daily_cashback(NUMERIC) FROM PUBLIC, anon, authenticated;

-- UTR auto-approve helper (used by public webhook with shared HMAC)
CREATE OR REPLACE FUNCTION public.auto_approve_deposit_by_utr(_utr TEXT, _amount NUMERIC, _payee TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req RECORD;
  _bal_before NUMERIC;
BEGIN
  IF _utr IS NULL OR length(trim(_utr)) < 6 THEN RAISE EXCEPTION 'UTR_REQUIRED' USING ERRCODE='P0001'; END IF;

  SELECT * INTO _req FROM public.deposit_requests
   WHERE utr = _utr AND status = 'PENDING'
   ORDER BY created_at DESC LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_request');
  END IF;
  IF abs(_req.amount - _amount) > 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch', 'expected', _req.amount, 'got', _amount);
  END IF;

  SELECT balance INTO _bal_before FROM public.profiles WHERE user_id = _req.user_id FOR UPDATE;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_before, balance_after, status, description, reference_id)
  VALUES (_req.user_id, 'DEPOSIT', _req.amount, _bal_before, _bal_before + _req.amount, 'COMPLETED',
          'Deposit auto-verified (UTR ' || _utr || ')', _req.id::TEXT);

  UPDATE public.profiles
     SET balance = balance + _req.amount,
         total_deposit = total_deposit + _req.amount,
         updated_at = now()
   WHERE user_id = _req.user_id;

  UPDATE public.deposit_requests
     SET status = 'APPROVED', auto_verified = true, processed_at = now()
   WHERE id = _req.id;

  INSERT INTO public.notifications(user_id, type, title, body, link, metadata)
  VALUES (_req.user_id, 'deposit_approved', 'Deposit auto-verified',
          '₹' || _req.amount::TEXT || ' credited (UTR ' || _utr || ')', '/wallet',
          jsonb_build_object('request_id', _req.id, 'utr', _utr));

  INSERT INTO public.audit_log(actor_id, actor_email, action, metadata)
  VALUES (NULL, 'system@utr', 'AUTO_APPROVE_DEPOSIT',
          jsonb_build_object('request_id', _req.id, 'utr', _utr, 'amount', _req.amount, 'payee', _payee));

  RETURN jsonb_build_object('ok', true, 'request_id', _req.id, 'amount', _req.amount);
END $$;

REVOKE ALL ON FUNCTION public.auto_approve_deposit_by_utr(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

-- Schedule daily cashback (03:30 IST = 22:00 UTC)
SELECT cron.unschedule('daily-cashback') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-cashback');
SELECT cron.schedule('daily-cashback', '0 22 * * *', $cron$ SELECT public.run_daily_cashback(0.05); $cron$);
