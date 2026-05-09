-- ============================================================
-- STORAGE: payment-screenshots bucket (private, user-folder policy)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-screenshots', 'payment-screenshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users read own screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins read all screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-screenshots'
  AND public.has_role(auth.uid(), 'admin')
);

-- ============================================================
-- NOTIFICATIONS table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,            -- bet_won, bet_lost, deposit_*, withdraw_*, broadcast, info
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Helpful: also make sure bets / wallet_transactions broadcast for win celebration
DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='bets';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bets';
  END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='wallet_transactions';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions';
  END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='market_results';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.market_results';
  END IF;
END $$;

ALTER TABLE public.bets REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.market_results REPLICA IDENTITY FULL;

-- ============================================================
-- Trigger: when a bet flips to WON, drop a notification
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_bet_settle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'WON' AND (OLD.status IS DISTINCT FROM 'WON') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id, 'bet_won',
      'You won ₹' || COALESCE(NEW.win_amount,0)::TEXT || '!',
      NEW.bet_type || ' ' || NEW.bet_number || ' on ' || NEW.market_id,
      '/dashboard/bets',
      jsonb_build_object('bet_id', NEW.id, 'win_amount', NEW.win_amount)
    );
  ELSIF NEW.status = 'LOST' AND (OLD.status IS DISTINCT FROM 'LOST') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.user_id, 'bet_lost',
      'Result declared',
      NEW.bet_type || ' ' || NEW.bet_number || ' did not win.',
      '/dashboard/bets',
      jsonb_build_object('bet_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bet_settle ON public.bets;
CREATE TRIGGER trg_notify_bet_settle
AFTER UPDATE ON public.bets
FOR EACH ROW EXECUTE FUNCTION public.notify_on_bet_settle();

-- ============================================================
-- approve_deposit / reject_deposit / approve_withdrawal / reject_withdrawal
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_deposit(_request_id UUID, _note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _req RECORD;
  _balance_before NUMERIC;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;

  SELECT * INTO _req FROM public.deposit_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF _req.status <> 'PENDING' THEN RAISE EXCEPTION 'ALREADY_PROCESSED' USING ERRCODE='P0001'; END IF;

  SELECT balance INTO _balance_before FROM public.profiles WHERE user_id = _req.user_id FOR UPDATE;

  INSERT INTO public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, status, description, reference_id)
  VALUES (
    _req.user_id, 'DEPOSIT', _req.amount, _balance_before, _balance_before + _req.amount,
    'COMPLETED',
    'Deposit approved (' || _req.method || COALESCE(' · UTR ' || _req.utr,'') || ')',
    _req.id::TEXT
  );

  UPDATE public.profiles
  SET balance = balance + _req.amount,
      total_deposit = total_deposit + _req.amount
  WHERE user_id = _req.user_id;

  UPDATE public.deposit_requests
  SET status='APPROVED', processed_at=now(), processed_by=_admin
  WHERE id=_request_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (_req.user_id, 'deposit_approved',
    'Deposit approved',
    '₹' || _req.amount::TEXT || ' credited to your wallet.',
    '/wallet',
    jsonb_build_object('request_id', _req.id, 'note', _note));

  INSERT INTO public.audit_log (actor_id, actor_email, action, metadata)
  VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin),
          'APPROVE_DEPOSIT',
          jsonb_build_object('request_id', _req.id, 'amount', _req.amount, 'user_id', _req.user_id));

  RETURN jsonb_build_object('success', true, 'newBalance', _balance_before + _req.amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_deposit(_request_id UUID, _reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _admin UUID := auth.uid(); _req RECORD;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='P0001'; END IF;

  SELECT * INTO _req FROM public.deposit_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF _req.status <> 'PENDING' THEN RAISE EXCEPTION 'ALREADY_PROCESSED' USING ERRCODE='P0001'; END IF;

  UPDATE public.deposit_requests
  SET status='REJECTED', processed_at=now(), processed_by=_admin, reject_reason=_reason
  WHERE id=_request_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (_req.user_id, 'deposit_rejected',
          'Deposit rejected',
          'Your ₹' || _req.amount::TEXT || ' deposit was rejected: ' || _reason,
          '/wallet',
          jsonb_build_object('request_id', _req.id, 'reason', _reason));

  INSERT INTO public.audit_log (actor_id, actor_email, action, reason, metadata)
  VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin), 'REJECT_DEPOSIT', _reason,
          jsonb_build_object('request_id', _req.id, 'amount', _req.amount, 'user_id', _req.user_id));

  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_request_id UUID, _note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _admin UUID := auth.uid(); _req RECORD; _balance_before NUMERIC;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;

  SELECT * INTO _req FROM public.withdrawal_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF _req.status <> 'PENDING' THEN RAISE EXCEPTION 'ALREADY_PROCESSED' USING ERRCODE='P0001'; END IF;

  SELECT balance INTO _balance_before FROM public.profiles WHERE user_id=_req.user_id FOR UPDATE;
  IF _balance_before < _req.amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %, need %', _balance_before, _req.amount USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, status, description, reference_id)
  VALUES (_req.user_id, 'WITHDRAWAL', -(_req.amount), _balance_before, _balance_before - _req.amount,
          'COMPLETED', 'Withdrawal approved (' || _req.method || ')', _req.id::TEXT);

  UPDATE public.profiles
  SET balance = balance - _req.amount,
      total_withdraw = total_withdraw + _req.amount
  WHERE user_id=_req.user_id;

  UPDATE public.withdrawal_requests
  SET status='APPROVED', processed_at=now(), processed_by=_admin
  WHERE id=_request_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (_req.user_id, 'withdraw_approved',
          'Withdrawal approved',
          '₹' || _req.amount::TEXT || ' has been sent to your account.',
          '/wallet',
          jsonb_build_object('request_id', _req.id, 'note', _note));

  INSERT INTO public.audit_log (actor_id, actor_email, action, metadata)
  VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin), 'APPROVE_WITHDRAWAL',
          jsonb_build_object('request_id', _req.id, 'amount', _req.amount, 'user_id', _req.user_id));

  RETURN jsonb_build_object('success', true, 'newBalance', _balance_before - _req.amount);
END; $$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_request_id UUID, _reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _admin UUID := auth.uid(); _req RECORD;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='P0001'; END IF;

  SELECT * INTO _req FROM public.withdrawal_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF _req.status <> 'PENDING' THEN RAISE EXCEPTION 'ALREADY_PROCESSED' USING ERRCODE='P0001'; END IF;

  UPDATE public.withdrawal_requests
  SET status='REJECTED', processed_at=now(), processed_by=_admin, reject_reason=_reason
  WHERE id=_request_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (_req.user_id, 'withdraw_rejected',
          'Withdrawal rejected',
          'Your ₹' || _req.amount::TEXT || ' withdrawal was rejected: ' || _reason,
          '/wallet',
          jsonb_build_object('request_id', _req.id, 'reason', _reason));

  INSERT INTO public.audit_log (actor_id, actor_email, action, reason, metadata)
  VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin), 'REJECT_WITHDRAWAL', _reason,
          jsonb_build_object('request_id', _req.id, 'amount', _req.amount, 'user_id', _req.user_id));

  RETURN jsonb_build_object('success', true);
END; $$;

-- Grant execute to authenticated for these admin RPCs (admin guard is inside)
GRANT EXECUTE ON FUNCTION public.approve_deposit(UUID, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deposit(UUID, TEXT)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(UUID, TEXT)  TO authenticated;