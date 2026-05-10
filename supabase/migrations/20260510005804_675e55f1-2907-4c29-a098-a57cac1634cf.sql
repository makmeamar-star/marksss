
CREATE TABLE public.quick_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_no BIGSERIAL UNIQUE,
  opens_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at TIMESTAMPTZ NOT NULL,
  declared_at TIMESTAMPTZ,
  result_digit SMALLINT,
  payout_multiplier NUMERIC NOT NULL DEFAULT 9,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','DECLARED'))
);
CREATE INDEX quick_rounds_status_idx ON public.quick_rounds(status, closes_at);
ALTER TABLE public.quick_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rounds public read" ON public.quick_rounds FOR SELECT USING (true);
CREATE POLICY "rounds admin all" ON public.quick_rounds FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.quick_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.quick_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digit SMALLINT NOT NULL CHECK (digit BETWEEN 0 AND 9),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','WON','LOST')),
  win_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX quick_bets_user_idx ON public.quick_bets(user_id, created_at DESC);
CREATE INDEX quick_bets_round_idx ON public.quick_bets(round_id);
ALTER TABLE public.quick_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quick bets read" ON public.quick_bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins read all quick bets" ON public.quick_bets FOR SELECT USING (public.has_role(auth.uid(),'admin'));

-- Place a bet: validates open round, deducts balance, records bet
CREATE OR REPLACE FUNCTION public.place_quick_bet(p_round_id UUID, p_digit SMALLINT, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  r public.quick_rounds%ROWTYPE;
  bal NUMERIC;
  bet_id UUID;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF p_amount < 10 OR p_amount > 5000 THEN RAISE EXCEPTION 'amount must be between 10 and 5000'; END IF;
  IF p_digit IS NULL OR p_digit < 0 OR p_digit > 9 THEN RAISE EXCEPTION 'digit out of range'; END IF;

  SELECT * INTO r FROM public.quick_rounds WHERE id = p_round_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'round not found'; END IF;
  IF r.status <> 'OPEN' OR now() >= r.closes_at THEN RAISE EXCEPTION 'round closed'; END IF;

  SELECT balance INTO bal FROM public.profiles WHERE user_id = uid FOR UPDATE;
  IF bal < p_amount THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  UPDATE public.profiles
    SET balance = balance - p_amount,
        total_bet = total_bet + p_amount,
        updated_at = now()
  WHERE user_id = uid;

  INSERT INTO public.quick_bets(round_id, user_id, digit, amount)
  VALUES (p_round_id, uid, p_digit, p_amount)
  RETURNING id INTO bet_id;

  INSERT INTO public.wallet_transactions(user_id, type, amount, balance_before, balance_after, status, description, reference_id)
  VALUES (uid, 'BET_DEBIT', -p_amount, bal, bal - p_amount, 'COMPLETED', 'Quick Play round #' || r.round_no, bet_id::text);

  RETURN jsonb_build_object('ok', true, 'bet_id', bet_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.place_quick_bet(UUID, SMALLINT, NUMERIC) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.place_quick_bet(UUID, SMALLINT, NUMERIC) TO authenticated;

-- Open the next round if needed (idempotent)
CREATE OR REPLACE FUNCTION public.tick_quick_play()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_round public.quick_rounds%ROWTYPE;
  expired RECORD;
  picked SMALLINT;
  total_pool NUMERIC;
  digit_pool NUMERIC;
  multiplier NUMERIC;
  declared_count INT := 0;
  bal NUMERIC;
BEGIN
  -- 1) Settle any expired OPEN rounds
  FOR expired IN
    SELECT * FROM public.quick_rounds WHERE status = 'OPEN' AND closes_at <= now() FOR UPDATE
  LOOP
    -- Pick the digit with the LEAST money on it (house-favourable but provably random tie-break)
    SELECT digit INTO picked FROM (
      SELECT g.d AS digit, COALESCE(SUM(b.amount), 0) AS pool
      FROM generate_series(0,9) g(d)
      LEFT JOIN public.quick_bets b ON b.round_id = expired.id AND b.digit = g.d
      GROUP BY g.d
      ORDER BY pool ASC, random() ASC
      LIMIT 1
    ) sub;
    IF picked IS NULL THEN picked := floor(random() * 10)::SMALLINT; END IF;

    multiplier := expired.payout_multiplier;

    UPDATE public.quick_rounds
      SET status = 'DECLARED', declared_at = now(), result_digit = picked
    WHERE id = expired.id;

    -- Mark winners and credit
    WITH winners AS (
      UPDATE public.quick_bets
         SET status = 'WON',
             win_amount = amount * multiplier,
             settled_at = now()
       WHERE round_id = expired.id AND digit = picked
       RETURNING user_id, amount * multiplier AS payout, id
    )
    UPDATE public.profiles p
       SET balance = p.balance + w.total_payout,
           total_win = p.total_win + w.total_payout,
           updated_at = now()
      FROM (SELECT user_id, SUM(payout) AS total_payout FROM winners GROUP BY user_id) w
     WHERE p.user_id = w.user_id;

    -- Wallet tx for each winner
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_before, balance_after, status, description, reference_id)
    SELECT b.user_id, 'BET_WIN', b.win_amount, 0, 0, 'COMPLETED',
           'Quick Play round #' || expired.round_no || ' win on ' || picked, b.id::text
    FROM public.quick_bets b
    WHERE b.round_id = expired.id AND b.status = 'WON';

    UPDATE public.quick_bets
       SET status = 'LOST', settled_at = now()
     WHERE round_id = expired.id AND status = 'PENDING';

    declared_count := declared_count + 1;
  END LOOP;

  -- 2) Ensure there is an OPEN round for the next 5 minutes
  SELECT * INTO current_round FROM public.quick_rounds
   WHERE status = 'OPEN' AND closes_at > now()
   ORDER BY closes_at DESC LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.quick_rounds(opens_at, closes_at, status)
    VALUES (now(), now() + INTERVAL '5 minutes', 'OPEN')
    RETURNING * INTO current_round;
  END IF;

  RETURN jsonb_build_object('ok', true, 'declared', declared_count, 'open_round', current_round.id, 'closes_at', current_round.closes_at);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tick_quick_play() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.tick_quick_play() TO authenticated, service_role;
