
-- 1) Add status flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (status IN ('ACTIVE','SUSPENDED'));

-- 2) Admin balance adjustment RPC (atomic + audited)
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  _user_id uuid, _delta numeric, _reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _admin uuid := auth.uid();
  _balance_before numeric;
  _new_balance numeric;
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF _delta IS NULL OR _delta = 0 THEN
    RAISE EXCEPTION 'INVALID_DELTA' USING ERRCODE='P0001';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='P0001';
  END IF;

  SELECT balance INTO _balance_before FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF _balance_before IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  _new_balance := _balance_before + _delta;
  IF _new_balance < 0 THEN
    RAISE EXCEPTION 'NEGATIVE_BALANCE: have %, delta %', _balance_before, _delta USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, status, description, reference_id)
  VALUES (
    _user_id,
    CASE WHEN _delta > 0 THEN 'ADMIN_CREDIT' ELSE 'ADMIN_DEBIT' END,
    _delta, _balance_before, _new_balance, 'COMPLETED',
    'Admin adjustment: ' || _reason, NULL
  );

  UPDATE public.profiles SET balance = _new_balance WHERE user_id = _user_id;

  INSERT INTO public.audit_log (actor_id, actor_email, action, reason, metadata)
  VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin),
          'ADMIN_BALANCE_ADJUST', _reason,
          jsonb_build_object('user_id', _user_id, 'delta', _delta,
                             'before', _balance_before, 'after', _new_balance));

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (_user_id,
          CASE WHEN _delta > 0 THEN 'admin_credit' ELSE 'admin_debit' END,
          CASE WHEN _delta > 0 THEN 'Wallet credited' ELSE 'Wallet debited' END,
          '₹' || abs(_delta)::text || ' — ' || _reason,
          '/wallet',
          jsonb_build_object('delta', _delta));

  RETURN jsonb_build_object('success', true, 'before', _balance_before, 'after', _new_balance);
END $$;

-- 3) Admin set user status (suspend / reactivate)
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  _user_id uuid, _status text, _reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid();
BEGIN
  IF _admin IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF _status NOT IN ('ACTIVE','SUSPENDED') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE='P0001';
  END IF;

  UPDATE public.profiles SET status = _status WHERE user_id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  INSERT INTO public.audit_log (actor_id, actor_email, action, reason, metadata)
  VALUES (_admin, (SELECT email FROM auth.users WHERE id=_admin),
          'ADMIN_USER_STATUS', _reason,
          jsonb_build_object('user_id', _user_id, 'status', _status));

  RETURN jsonb_build_object('success', true, 'status', _status);
END $$;

-- 4) Block bets from suspended users (defense in depth)
CREATE OR REPLACE FUNCTION public.block_bets_for_suspended()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text;
BEGIN
  SELECT status INTO _status FROM public.profiles WHERE user_id = NEW.user_id;
  IF _status = 'SUSPENDED' THEN
    RAISE EXCEPTION 'USER_SUSPENDED' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_block_bets_for_suspended ON public.bets;
CREATE TRIGGER trg_block_bets_for_suspended
BEFORE INSERT ON public.bets
FOR EACH ROW EXECUTE FUNCTION public.block_bets_for_suspended();
