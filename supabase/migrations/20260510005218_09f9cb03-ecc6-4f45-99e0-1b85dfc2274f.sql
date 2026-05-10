
-- ============ TABLES ============
CREATE TABLE public.user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_claim_date DATE,
  total_claimed NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streak read" ON public.user_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own streak write" ON public.user_streaks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.daily_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target INT NOT NULL DEFAULT 1,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions public read" ON public.daily_missions FOR SELECT USING (is_active = true);
CREATE POLICY "missions admin all" ON public.daily_missions FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_code TEXT NOT NULL,
  mission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  progress INT NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  UNIQUE (user_id, mission_code, mission_date)
);
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own missions read" ON public.user_missions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own missions write" ON public.user_missions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.daily_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  prize_amount NUMERIC NOT NULL,
  prize_label TEXT NOT NULL,
  spun_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, spin_date)
);
ALTER TABLE public.daily_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spins read" ON public.daily_spins FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.rewards_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rewards_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger read" ON public.rewards_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX rewards_ledger_user_idx ON public.rewards_ledger(user_id, created_at DESC);

-- ============ SEED DEFAULT MISSIONS ============
INSERT INTO public.daily_missions (code, title, description, target, reward_amount, sort_order) VALUES
('place_3_bets','Lucky Trio','Place 3 bets today',3,10,1),
('deposit_today','Top Up','Make a deposit today',1,15,2),
('view_5_results','Result Watcher','Check 5 market results',5,5,3),
('login_visit','Daily Visit','Open the app today',1,2,4);

-- ============ FUNCTIONS ============
-- Daily streak claim
CREATE OR REPLACE FUNCTION public.claim_daily_streak()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  s public.user_streaks%ROWTYPE;
  new_streak INT;
  reward NUMERIC;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  INSERT INTO public.user_streaks (user_id) VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO s FROM public.user_streaks WHERE user_id = uid FOR UPDATE;

  IF s.last_claim_date = CURRENT_DATE THEN
    RETURN jsonb_build_object('ok',false,'reason','already_claimed','streak',s.current_streak);
  END IF;

  IF s.last_claim_date = CURRENT_DATE - 1 THEN
    new_streak := s.current_streak + 1;
  ELSE
    new_streak := 1;
  END IF;

  reward := LEAST(5 + (new_streak - 1) * 2, 50);

  UPDATE public.user_streaks
    SET current_streak = new_streak,
        longest_streak = GREATEST(longest_streak, new_streak),
        last_claim_date = CURRENT_DATE,
        total_claimed = total_claimed + reward,
        updated_at = now()
   WHERE user_id = uid;

  UPDATE public.profiles SET balance = balance + reward, updated_at = now() WHERE user_id = uid;

  INSERT INTO public.rewards_ledger(user_id, source, amount, meta)
  VALUES (uid, 'streak', reward, jsonb_build_object('streak', new_streak));

  RETURN jsonb_build_object('ok',true,'streak',new_streak,'reward',reward);
END;
$$;

-- Daily spin wheel
CREATE OR REPLACE FUNCTION public.spin_daily_wheel()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  prizes NUMERIC[] := ARRAY[2,5,10,20,50,100];
  weights INT[] := ARRAY[40,25,18,10,5,2];
  total INT;
  pick INT;
  acc INT := 0;
  i INT;
  prize NUMERIC;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF EXISTS (SELECT 1 FROM public.daily_spins WHERE user_id = uid AND spin_date = CURRENT_DATE) THEN
    RETURN jsonb_build_object('ok',false,'reason','already_spun');
  END IF;

  total := 0;
  FOR i IN 1 .. array_length(weights,1) LOOP total := total + weights[i]; END LOOP;
  pick := floor(random() * total)::INT;
  prize := prizes[array_length(prizes,1)];
  FOR i IN 1 .. array_length(weights,1) LOOP
    acc := acc + weights[i];
    IF pick < acc THEN
      prize := prizes[i];
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.daily_spins(user_id, prize_amount, prize_label)
  VALUES (uid, prize, '₹' || prize::TEXT);

  UPDATE public.profiles SET balance = balance + prize, updated_at = now() WHERE user_id = uid;

  INSERT INTO public.rewards_ledger(user_id, source, amount, meta)
  VALUES (uid, 'spin', prize, jsonb_build_object('date', CURRENT_DATE));

  RETURN jsonb_build_object('ok',true,'prize',prize);
END;
$$;

-- Mission progress increment + claim when complete
CREATE OR REPLACE FUNCTION public.increment_mission(p_code TEXT, p_amount INT DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  m public.daily_missions%ROWTYPE;
  um public.user_missions%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO m FROM public.daily_missions WHERE code = p_code AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','no_mission'); END IF;

  INSERT INTO public.user_missions(user_id, mission_code, mission_date, progress)
  VALUES (uid, p_code, CURRENT_DATE, LEAST(p_amount, m.target))
  ON CONFLICT (user_id, mission_code, mission_date)
  DO UPDATE SET progress = LEAST(public.user_missions.progress + p_amount, m.target);

  RETURN jsonb_build_object('ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_mission(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  m public.daily_missions%ROWTYPE;
  um public.user_missions%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO m FROM public.daily_missions WHERE code = p_code AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission not found'; END IF;

  SELECT * INTO um FROM public.user_missions
   WHERE user_id = uid AND mission_code = p_code AND mission_date = CURRENT_DATE
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','no_progress'); END IF;
  IF um.progress < m.target THEN RETURN jsonb_build_object('ok',false,'reason','incomplete'); END IF;
  IF um.claimed_at IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'reason','already_claimed'); END IF;

  UPDATE public.user_missions SET claimed_at = now() WHERE id = um.id;
  UPDATE public.profiles SET balance = balance + m.reward_amount, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.rewards_ledger(user_id, source, amount, meta)
  VALUES (uid, 'mission', m.reward_amount, jsonb_build_object('code', p_code));

  RETURN jsonb_build_object('ok',true,'reward', m.reward_amount);
END;
$$;
