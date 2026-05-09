
-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  total_deposit NUMERIC NOT NULL DEFAULT 0,
  total_withdraw NUMERIC NOT NULL DEFAULT 0,
  total_bet NUMERIC NOT NULL DEFAULT 0,
  total_win NUMERIC NOT NULL DEFAULT 0,
  kyc_status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND balance = (SELECT balance FROM public.profiles WHERE user_id = auth.uid()));
  -- Users can update profile fields but NOT balance directly (balance only changes via SECURITY DEFINER fns)

CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- PANA CHART LOOKUP
-- ============================================================
CREATE TABLE public.pana_chart (
  pana TEXT PRIMARY KEY,
  digit SMALLINT NOT NULL,
  pana_type TEXT NOT NULL CHECK (pana_type IN ('SINGLE','DOUBLE','TRIPLE'))
);

ALTER TABLE public.pana_chart ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads pana chart" ON public.pana_chart FOR SELECT TO public USING (true);

-- Seed canonical 220 panas
INSERT INTO public.pana_chart (pana, digit, pana_type) VALUES
-- digit 0
('550',0,'DOUBLE'),('668',0,'DOUBLE'),('244',0,'DOUBLE'),('299',0,'DOUBLE'),('226',0,'DOUBLE'),('488',0,'DOUBLE'),('677',0,'DOUBLE'),('118',0,'DOUBLE'),('334',0,'DOUBLE'),('000',0,'TRIPLE'),
-- digit 1
('100',1,'DOUBLE'),('119',1,'DOUBLE'),('155',1,'DOUBLE'),('227',1,'DOUBLE'),('335',1,'DOUBLE'),('344',1,'DOUBLE'),('399',1,'DOUBLE'),('588',1,'DOUBLE'),('669',1,'DOUBLE'),('111',1,'TRIPLE'),
-- digit 2
('200',2,'DOUBLE'),('110',2,'DOUBLE'),('228',2,'DOUBLE'),('255',2,'DOUBLE'),('336',2,'DOUBLE'),('499',2,'SINGLE'),('660',2,'DOUBLE'),('688',2,'DOUBLE'),('778',2,'DOUBLE'),('222',2,'TRIPLE'),
-- digit 3
('300',3,'DOUBLE'),('166',3,'DOUBLE'),('229',3,'DOUBLE'),('337',3,'DOUBLE'),('355',3,'DOUBLE'),('445',3,'DOUBLE'),('599',3,'DOUBLE'),('779',3,'DOUBLE'),('788',3,'DOUBLE'),('333',3,'TRIPLE'),
-- digit 4
('400',4,'DOUBLE'),('112',4,'DOUBLE'),('220',4,'DOUBLE'),('266',4,'DOUBLE'),('338',4,'DOUBLE'),('446',4,'DOUBLE'),('455',4,'DOUBLE'),('699',4,'DOUBLE'),('889',4,'DOUBLE'),('444',4,'TRIPLE'),
-- digit 5
('500',5,'DOUBLE'),('113',5,'DOUBLE'),('122',5,'DOUBLE'),('177',5,'DOUBLE'),('339',5,'DOUBLE'),('366',5,'DOUBLE'),('447',5,'DOUBLE'),('799',5,'DOUBLE'),('880',5,'DOUBLE'),('555',5,'TRIPLE'),
-- digit 6
('600',6,'DOUBLE'),('114',6,'DOUBLE'),('123',6,'SINGLE'),('258',6,'SINGLE'),('456',6,'SINGLE'),('357',6,'SINGLE'),('169',6,'SINGLE'),('178',6,'SINGLE'),('249',6,'SINGLE'),('666',6,'TRIPLE'),
-- digit 7
('700',7,'DOUBLE'),('115',7,'DOUBLE'),('133',7,'DOUBLE'),('188',7,'DOUBLE'),('223',7,'DOUBLE'),('377',7,'DOUBLE'),('566',7,'DOUBLE'),('449',7,'DOUBLE'),('124',7,'SINGLE'),('777',7,'TRIPLE'),
-- digit 8
('800',8,'DOUBLE'),('116',8,'DOUBLE'),('224',8,'DOUBLE'),('233',8,'DOUBLE'),('288',8,'DOUBLE'),('440',8,'DOUBLE'),('477',8,'DOUBLE'),('558',8,'DOUBLE'),('990',8,'DOUBLE'),('888',8,'TRIPLE'),
-- digit 9
('900',9,'DOUBLE'),('117',9,'DOUBLE'),('144',9,'DOUBLE'),('199',9,'DOUBLE'),('225',9,'DOUBLE'),('388',9,'DOUBLE'),('559',9,'DOUBLE'),('667',9,'DOUBLE'),('289',9,'SINGLE'),('999',9,'TRIPLE')
ON CONFLICT (pana) DO NOTHING;

-- ============================================================
-- DEPOSIT / WITHDRAWAL request tables (scaffolding for Wallet)
-- ============================================================
CREATE TABLE public.deposit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  utr TEXT,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reject_reason TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own deposit requests" ON public.deposit_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own deposit requests" ON public.deposit_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'PENDING');
CREATE POLICY "Admins manage deposit requests" ON public.deposit_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  bank_details JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','REJECTED')),
  reject_reason TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own withdrawals" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'PENDING');
CREATE POLICY "Admins manage withdrawals" ON public.withdrawal_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- HELPER: is_admin (callable by any authenticated user)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- HELPER: validate_pana
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_pana(_pana TEXT)
RETURNS TABLE(valid BOOLEAN, digit SMALLINT, pana_type TEXT)
LANGUAGE SQL STABLE SET search_path = public
AS $$
  SELECT
    CASE WHEN p.pana IS NOT NULL THEN true ELSE false END AS valid,
    p.digit,
    p.pana_type
  FROM (SELECT _pana::TEXT AS pana) inp
  LEFT JOIN public.pana_chart p ON p.pana = inp.pana
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.validate_pana(TEXT) TO authenticated, anon;

-- ============================================================
-- SIGNUP TRIGGER: create profile + grant admin to first signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (user_id, username, email, balance, total_deposit)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    1000, -- dev welcome bonus
    1000
  );

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PLACE_BETS: atomic bet placement with balance check
-- ============================================================
-- Input items: jsonb array of { session, bet_type, bet_number, amount, payout }
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

  -- Fetch market with lock
  SELECT * INTO _market FROM public.markets WHERE id = _market_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MARKET_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF _market.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'MARKET_SUSPENDED' USING ERRCODE = 'P0001';
  END IF;

  -- Compute session open status (IST = UTC+5:30)
  _now_hhmm := to_char((now() AT TIME ZONE 'Asia/Kolkata')::time, 'HH24:MI');
  _open_session_open := (_now_hhmm < _market.open_time) AND (_session_date = (now() AT TIME ZONE 'Asia/Kolkata')::date);
  _close_session_open := (_now_hhmm < _market.close_time) AND (_session_date = (now() AT TIME ZONE 'Asia/Kolkata')::date);

  -- Check if results already declared for that session (block bets)
  SELECT * INTO _existing_result FROM public.market_results
    WHERE market_id = _market_id AND session_date = _session_date;
  IF FOUND AND _existing_result.open_pana IS NOT NULL THEN _open_session_open := false; END IF;
  IF FOUND AND _existing_result.close_pana IS NOT NULL THEN _close_session_open := false; END IF;

  -- Iterate items
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _session := _item->>'session';
    _bet_type := _item->>'bet_type';
    _bet_number := _item->>'bet_number';
    _amount := (_item->>'amount')::NUMERIC;
    _payout := (_item->>'payout')::NUMERIC;

    IF _amount IS NULL OR _amount < _market.min_bet OR _amount > _market.max_bet THEN
      RAISE EXCEPTION 'INVALID_AMOUNT: %', _amount USING ERRCODE = 'P0001';
    END IF;

    -- Session open check
    IF _session = 'OPEN' AND NOT _open_session_open THEN
      RAISE EXCEPTION 'OPEN_SESSION_CLOSED' USING ERRCODE = 'P0001';
    END IF;
    IF _session = 'CLOSE' AND NOT _close_session_open THEN
      RAISE EXCEPTION 'CLOSE_SESSION_CLOSED' USING ERRCODE = 'P0001';
    END IF;

    -- Bet number validation by type
    IF _bet_type IN ('SINGLE_OPEN','SINGLE_CLOSE') THEN
      IF _bet_number !~ '^[0-9]$' THEN
        RAISE EXCEPTION 'INVALID_DIGIT: %', _bet_number USING ERRCODE = 'P0001';
      END IF;
    ELSIF _bet_type = 'JODI' THEN
      IF _bet_number !~ '^[0-9]{2}$' THEN
        RAISE EXCEPTION 'INVALID_JODI: %', _bet_number USING ERRCODE = 'P0001';
      END IF;
    ELSIF _bet_type IN ('SINGLE_PANA','DOUBLE_PANA','TRIPLE_PANA') THEN
      SELECT * INTO _validation FROM public.validate_pana(_bet_number);
      IF NOT _validation.valid THEN
        RAISE EXCEPTION 'INVALID_PANA: %', _bet_number USING ERRCODE = 'P0001';
      END IF;
      IF _bet_type = 'SINGLE_PANA' AND _validation.pana_type <> 'SINGLE' THEN
        RAISE EXCEPTION 'PANA_TYPE_MISMATCH: % is %, expected SINGLE', _bet_number, _validation.pana_type USING ERRCODE = 'P0001';
      END IF;
      IF _bet_type = 'DOUBLE_PANA' AND _validation.pana_type <> 'DOUBLE' THEN
        RAISE EXCEPTION 'PANA_TYPE_MISMATCH: % is %, expected DOUBLE', _bet_number, _validation.pana_type USING ERRCODE = 'P0001';
      END IF;
      IF _bet_type = 'TRIPLE_PANA' AND _validation.pana_type <> 'TRIPLE' THEN
        RAISE EXCEPTION 'PANA_TYPE_MISMATCH: % is %, expected TRIPLE', _bet_number, _validation.pana_type USING ERRCODE = 'P0001';
      END IF;
    END IF;

    _total := _total + _amount;
  END LOOP;

  -- Lock profile and check balance
  SELECT * INTO _profile FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF _profile.balance < _total THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %, need %', _profile.balance, _total USING ERRCODE = 'P0001';
  END IF;

  _balance_before := _profile.balance;

  -- Insert bets and wallet transactions
  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO public.bets (user_id, market_id, session_date, session, bet_type, bet_number, amount, payout, status)
    VALUES (
      _user_id,
      _market_id,
      _session_date,
      _item->>'session',
      _item->>'bet_type',
      _item->>'bet_number',
      (_item->>'amount')::NUMERIC,
      (_item->>'payout')::NUMERIC,
      'PENDING'
    )
    RETURNING id INTO _new_bet_id;

    _bet_ids := array_append(_bet_ids, _new_bet_id);

    INSERT INTO public.wallet_transactions
      (user_id, type, amount, balance_before, balance_after, status, description, reference_id)
    VALUES (
      _user_id,
      'BET_PLACED',
      -((_item->>'amount')::NUMERIC),
      _balance_before,
      _balance_before - (_item->>'amount')::NUMERIC,
      'COMPLETED',
      _item->>'bet_type' || ' ' || (_item->>'bet_number') || ' on ' || _market.display_name,
      _new_bet_id::TEXT
    );
    _balance_before := _balance_before - (_item->>'amount')::NUMERIC;
  END LOOP;

  -- Update profile
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
GRANT EXECUTE ON FUNCTION public.place_bets(TEXT, DATE, JSONB) TO authenticated;

-- ============================================================
-- DECLARE_RESULT: atomic result declaration + settlement
-- ============================================================
CREATE OR REPLACE FUNCTION public.declare_result(
  _market_id TEXT,
  _session_date DATE,
  _session TEXT,            -- 'OPEN' or 'CLOSE'
  _pana TEXT,
  _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _is_admin BOOLEAN;
  _validation RECORD;
  _digit SMALLINT;
  _market RECORD;
  _result_row RECORD;
  _new_open_pana TEXT;
  _new_close_pana TEXT;
  _new_open_digit SMALLINT;
  _new_close_digit SMALLINT;
  _new_jodi TEXT;
  _bet RECORD;
  _winners INT := 0;
  _losers INT := 0;
  _payout_total NUMERIC := 0;
  _balance_before NUMERIC;
  _won BOOLEAN;
  _win_amount NUMERIC;
BEGIN
  -- Auth + admin check
  IF _user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT public.has_role(_user_id, 'admin') INTO _is_admin;
  IF NOT _is_admin THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501'; END IF;

  IF _session NOT IN ('OPEN','CLOSE') THEN
    RAISE EXCEPTION 'INVALID_SESSION: %', _session USING ERRCODE = 'P0001';
  END IF;

  -- Validate pana
  SELECT * INTO _validation FROM public.validate_pana(_pana);
  IF NOT _validation.valid THEN
    RAISE EXCEPTION 'INVALID_PANA: %', _pana USING ERRCODE = 'P0001';
  END IF;
  _digit := _validation.digit;

  -- Fetch market
  SELECT * INTO _market FROM public.markets WHERE id = _market_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MARKET_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  -- Get or create result row
  SELECT * INTO _result_row FROM public.market_results
    WHERE market_id = _market_id AND session_date = _session_date FOR UPDATE;

  IF NOT FOUND THEN
    -- Insert new
    IF _session = 'OPEN' THEN
      _new_open_pana := _pana; _new_open_digit := _digit;
    ELSE
      _new_close_pana := _pana; _new_close_digit := _digit;
    END IF;
    INSERT INTO public.market_results (market_id, session_date, open_pana, open_digit, close_pana, close_digit, status, declared_at, declared_by)
    VALUES (_market_id, _session_date, _new_open_pana, _new_open_digit, _new_close_pana, _new_close_digit, 'DECLARED', now(), _user_id);
  ELSE
    -- Update existing — guard against re-declaring same session
    IF _session = 'OPEN' AND _result_row.open_pana IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_DECLARED: open' USING ERRCODE = 'P0001';
    END IF;
    IF _session = 'CLOSE' AND _result_row.close_pana IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_DECLARED: close' USING ERRCODE = 'P0001';
    END IF;
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
    SET open_pana = _new_open_pana, open_digit = _new_open_digit,
        close_pana = _new_close_pana, close_digit = _new_close_digit,
        jodi = _new_jodi, status = 'DECLARED',
        declared_at = now(), declared_by = _user_id
    WHERE market_id = _market_id AND session_date = _session_date;
  END IF;

  -- Settle pending bets for this session
  FOR _bet IN
    SELECT b.* FROM public.bets b
    WHERE b.market_id = _market_id
      AND b.session_date = _session_date
      AND b.status = 'PENDING'
      AND (
        (_session = 'OPEN' AND b.session = 'OPEN' AND b.bet_type IN ('SINGLE_OPEN','SINGLE_PANA','DOUBLE_PANA','TRIPLE_PANA'))
        OR (_session = 'CLOSE' AND b.session = 'CLOSE' AND b.bet_type IN ('SINGLE_CLOSE','SINGLE_PANA','DOUBLE_PANA','TRIPLE_PANA'))
        OR (_new_jodi IS NOT NULL AND b.bet_type IN ('JODI','HALF_SANGAM','FULL_SANGAM'))
      )
    FOR UPDATE
  LOOP
    _won := false;
    _win_amount := 0;
    -- Eval each type
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
      -- "digit-pana" or "pana-digit"
      IF _new_open_digit IS NOT NULL AND _new_close_pana IS NOT NULL
         AND _bet.bet_number = _new_open_digit::TEXT || '-' || _new_close_pana THEN
        _won := true;
      ELSIF _new_open_pana IS NOT NULL AND _new_close_digit IS NOT NULL
         AND _bet.bet_number = _new_open_pana || '-' || _new_close_digit::TEXT THEN
        _won := true;
      END IF;
    ELSIF _bet.bet_type = 'FULL_SANGAM' THEN
      _won := _new_open_pana IS NOT NULL AND _new_close_pana IS NOT NULL
              AND _bet.bet_number = _new_open_pana || '-' || _new_close_pana;
    END IF;

    IF _won THEN
      _win_amount := round(_bet.amount * _bet.payout, 2);
      _winners := _winners + 1;
      _payout_total := _payout_total + _win_amount;

      UPDATE public.bets SET status = 'WON', win_amount = _win_amount, settled_at = now() WHERE id = _bet.id;

      SELECT balance INTO _balance_before FROM public.profiles WHERE user_id = _bet.user_id FOR UPDATE;
      INSERT INTO public.wallet_transactions
        (user_id, type, amount, balance_before, balance_after, status, description, reference_id)
      VALUES (
        _bet.user_id, 'BET_WIN', _win_amount, _balance_before, _balance_before + _win_amount,
        'COMPLETED', 'Win: ' || _bet.bet_type || ' ' || _bet.bet_number, _bet.id::TEXT
      );
      UPDATE public.profiles
      SET balance = balance + _win_amount,
          total_win = total_win + _win_amount
      WHERE user_id = _bet.user_id;
    ELSE
      _losers := _losers + 1;
      UPDATE public.bets SET status = 'LOST', settled_at = now() WHERE id = _bet.id;
    END IF;
  END LOOP;

  -- Audit log
  INSERT INTO public.audit_log (actor_id, actor_email, action, market_id, session_date, session, pana, reason, metadata)
  VALUES (_user_id, (SELECT email FROM auth.users WHERE id = _user_id),
          'DECLARE', _market_id, _session_date, _session, _pana, _reason,
          jsonb_build_object('winners', _winners, 'losers', _losers, 'payout', _payout_total, 'digit', _digit));

  RETURN jsonb_build_object(
    'success', true,
    'pana', _pana, 'digit', _digit, 'jodi', _new_jodi,
    'winners', _winners, 'losers', _losers, 'payout', _payout_total
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.declare_result(TEXT, DATE, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- CORRECT_RESULT: reverse + re-settle within 10-min window
-- ============================================================
CREATE OR REPLACE FUNCTION public.correct_result(
  _market_id TEXT,
  _session_date DATE,
  _session TEXT,
  _new_pana TEXT,
  _reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
  _won BOOLEAN;
  _win_amount NUMERIC;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT public.has_role(_user_id, 'admin') INTO _is_admin;
  IF NOT _is_admin THEN RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _validation FROM public.validate_pana(_new_pana);
  IF NOT _validation.valid THEN RAISE EXCEPTION 'INVALID_PANA: %', _new_pana USING ERRCODE = 'P0001'; END IF;
  _digit := _validation.digit;

  SELECT * INTO _result_row FROM public.market_results
    WHERE market_id = _market_id AND session_date = _session_date FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESULT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  -- 10-min correction window
  IF _result_row.declared_at IS NULL OR (now() - _result_row.declared_at) > interval '10 minutes' THEN
    RAISE EXCEPTION 'CORRECTION_WINDOW_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  -- Capture previous + reverse all bets settled for this session
  IF _session = 'OPEN' THEN
    _previous_pana := _result_row.open_pana;
  ELSE
    _previous_pana := _result_row.close_pana;
  END IF;

  -- Reverse settled bets touching this session: refund wins
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
              'COMPLETED', 'Reversal: ' || _bet.bet_type || ' ' || _bet.bet_number, _bet.id::TEXT);
      UPDATE public.profiles SET balance = balance - _bet.win_amount,
                                  total_win = greatest(0, total_win - _bet.win_amount)
        WHERE user_id = _bet.user_id;
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

  -- Re-settle (same loop as declare_result)
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
      IF _new_open_digit IS NOT NULL AND _new_close_pana IS NOT NULL
         AND _bet.bet_number = _new_open_digit::TEXT || '-' || _new_close_pana THEN _won := true;
      ELSIF _new_open_pana IS NOT NULL AND _new_close_digit IS NOT NULL
         AND _bet.bet_number = _new_open_pana || '-' || _new_close_digit::TEXT THEN _won := true;
      END IF;
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
              'COMPLETED', 'Win (corrected): ' || _bet.bet_type || ' ' || _bet.bet_number, _bet.id::TEXT);
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
          'CORRECT', _market_id, _session_date, _session, _new_pana, _previous_pana, _reason,
          jsonb_build_object('winners', _winners, 'losers', _losers, 'payout', _payout_total, 'digit', _digit));

  RETURN jsonb_build_object(
    'success', true, 'pana', _new_pana, 'previousPana', _previous_pana,
    'digit', _digit, 'jodi', _new_jodi,
    'winners', _winners, 'losers', _losers, 'payout', _payout_total
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.correct_result(TEXT, DATE, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- REALTIME: enable publication for live updates
-- ============================================================
ALTER TABLE public.markets REPLICA IDENTITY FULL;
ALTER TABLE public.market_results REPLICA IDENTITY FULL;
ALTER TABLE public.bets REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.audit_log REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.markets; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.market_results; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bets; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
