
-- 1) Profiles: referral fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID;

CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..7 LOOP
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN out;
END $$;

-- Backfill missing codes
DO $$
DECLARE p RECORD; c TEXT;
BEGIN
  FOR p IN SELECT user_id FROM public.profiles WHERE referral_code IS NULL LOOP
    LOOP
      c := public.gen_referral_code();
      BEGIN
        UPDATE public.profiles SET referral_code = c WHERE user_id = p.user_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN CONTINUE;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Auto-assign referral_code on insert via trigger on profiles
CREATE OR REPLACE FUNCTION public.profiles_assign_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c TEXT;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      c := public.gen_referral_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = c);
    END LOOP;
    NEW.referral_code := c;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_assign_ref ON public.profiles;
CREATE TRIGGER trg_profiles_assign_ref BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_assign_referral_code();

-- 2) Referrals log
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referee_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL,
  signup_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_deposit_at TIMESTAMPTZ,
  signup_bonus_paid NUMERIC NOT NULL DEFAULT 0,
  lifetime_commission NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own referral rows" ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());
CREATE POLICY "Admins read all referrals" ON public.referrals
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 3) Apply referral code (called by user shortly after signup)
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  ref UUID;
  me public.profiles%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF _code IS NULL OR length(trim(_code)) = 0 THEN RAISE EXCEPTION 'CODE_REQUIRED' USING ERRCODE='P0001'; END IF;

  SELECT * INTO me FROM public.profiles WHERE user_id = uid FOR UPDATE;
  IF me.referred_by IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_REFERRED' USING ERRCODE='P0001'; END IF;
  IF me.total_deposit > 0 THEN RAISE EXCEPTION 'TOO_LATE_HAS_DEPOSITS' USING ERRCODE='P0001'; END IF;

  SELECT user_id INTO ref FROM public.profiles WHERE referral_code = upper(trim(_code));
  IF ref IS NULL THEN RAISE EXCEPTION 'INVALID_CODE' USING ERRCODE='P0001'; END IF;
  IF ref = uid THEN RAISE EXCEPTION 'SELF_REFERRAL' USING ERRCODE='P0001'; END IF;

  UPDATE public.profiles SET referred_by = ref WHERE user_id = uid;

  INSERT INTO public.referrals(referrer_id, referee_id, code)
  VALUES (ref, uid, upper(trim(_code)))
  ON CONFLICT (referee_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'referrer', ref);
END $$;

REVOKE ALL ON FUNCTION public.apply_referral_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT) TO authenticated;

-- 4) Award referral on first deposit + lifetime commission on every deposit
-- Hook into approve_deposit by adding a separate AFTER trigger on wallet_transactions for type=DEPOSIT/COMPLETED
CREATE OR REPLACE FUNCTION public.referral_on_deposit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref UUID;
  signup_bonus NUMERIC := 50;
  min_first_deposit NUMERIC := 500;
  commission_rate NUMERIC := 0.02;
  commission NUMERIC;
  bal_before NUMERIC;
  is_first BOOLEAN;
BEGIN
  IF NEW.type <> 'DEPOSIT' OR NEW.status <> 'COMPLETED' OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT referred_by INTO ref FROM public.profiles WHERE user_id = NEW.user_id;
  IF ref IS NULL THEN RETURN NEW; END IF;

  SELECT first_deposit_at IS NULL INTO is_first FROM public.referrals WHERE referee_id = NEW.user_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- First deposit signup bonus
  IF is_first AND NEW.amount >= min_first_deposit THEN
    SELECT balance INTO bal_before FROM public.profiles WHERE user_id = ref FOR UPDATE;
    UPDATE public.profiles
       SET balance = balance + signup_bonus,
           bonus_balance = bonus_balance + signup_bonus
     WHERE user_id = ref;
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_before, balance_after, status, description)
    VALUES (ref, 'REFERRAL_BONUS', signup_bonus, bal_before, bal_before + signup_bonus, 'COMPLETED',
            'Referral signup bonus');
    UPDATE public.referrals
       SET first_deposit_at = now(), signup_bonus_paid = signup_bonus
     WHERE referee_id = NEW.user_id;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (ref, 'referral_bonus', 'Referral bonus!',
            '₹' || signup_bonus::TEXT || ' for your friend''s first deposit.', '/referrals');
  END IF;

  -- Lifetime commission on every deposit
  commission := round(NEW.amount * commission_rate, 2);
  IF commission >= 1 THEN
    SELECT balance INTO bal_before FROM public.profiles WHERE user_id = ref FOR UPDATE;
    UPDATE public.profiles
       SET balance = balance + commission,
           bonus_balance = bonus_balance + commission
     WHERE user_id = ref;
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_before, balance_after, status, description)
    VALUES (ref, 'REFERRAL_BONUS', commission, bal_before, bal_before + commission, 'COMPLETED',
            'Referral commission ' || (commission_rate*100) || '%');
    UPDATE public.referrals
       SET lifetime_commission = lifetime_commission + commission
     WHERE referee_id = NEW.user_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_referral_on_deposit ON public.wallet_transactions;
CREATE TRIGGER trg_referral_on_deposit
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.referral_on_deposit();

-- 5) Achievements catalog
CREATE TABLE IF NOT EXISTS public.achievements (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'trophy',
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active achievements" ON public.achievements
  FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "Admins manage achievements" ON public.achievements
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.achievements(code, title, description, icon, reward_amount, sort_order) VALUES
  ('FIRST_BET','First Bet','Place your first bet','target',10,1),
  ('FIRST_WIN','First Win','Win your first bet','trophy',50,2),
  ('STREAK_7','7-Day Streak','Claim daily reward 7 days in a row','flame',100,3),
  ('BIG_WIN','Big Win','Win ₹10,000 in a single bet','sparkles',250,4),
  ('REFER_3','Recruiter','Refer 3 friends who deposit','users',200,5),
  ('PANA_MASTER','Pana Master','Win on a triple pana','crown',500,6)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reward_paid NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(user_id, code)
);
CREATE INDEX IF NOT EXISTS idx_ua_user ON public.user_achievements(user_id);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own achievements" ON public.user_achievements
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all achievements" ON public.user_achievements
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public._unlock_achievement(_uid UUID, _code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.achievements%ROWTYPE;
  bal_before NUMERIC;
BEGIN
  SELECT * INTO a FROM public.achievements WHERE code = _code AND active = true;
  IF NOT FOUND THEN RETURN; END IF;
  BEGIN
    INSERT INTO public.user_achievements(user_id, code, reward_paid)
    VALUES (_uid, _code, a.reward_amount);
  EXCEPTION WHEN unique_violation THEN RETURN;
  END;
  IF a.reward_amount > 0 THEN
    SELECT balance INTO bal_before FROM public.profiles WHERE user_id = _uid FOR UPDATE;
    UPDATE public.profiles
       SET balance = balance + a.reward_amount,
           bonus_balance = bonus_balance + a.reward_amount
     WHERE user_id = _uid;
    INSERT INTO public.wallet_transactions(user_id, type, amount, balance_before, balance_after, status, description)
    VALUES (_uid, 'BONUS', a.reward_amount, bal_before, bal_before + a.reward_amount, 'COMPLETED',
            'Achievement: ' || a.title);
  END IF;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (_uid, 'achievement', 'Achievement unlocked: ' || a.title,
          a.description || CASE WHEN a.reward_amount > 0 THEN ' (+₹' || a.reward_amount::TEXT || ')' ELSE '' END,
          '/achievements');
END $$;

-- Trigger on bet insert (FIRST_BET)
CREATE OR REPLACE FUNCTION public.check_ach_on_bet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._unlock_achievement(NEW.user_id, 'FIRST_BET');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ach_on_bet ON public.bets;
CREATE TRIGGER trg_ach_on_bet AFTER INSERT ON public.bets
  FOR EACH ROW EXECUTE FUNCTION public.check_ach_on_bet();

-- Trigger on bet settle (FIRST_WIN, BIG_WIN, PANA_MASTER)
CREATE OR REPLACE FUNCTION public.check_ach_on_settle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'WON' AND (OLD.status IS DISTINCT FROM 'WON') THEN
    PERFORM public._unlock_achievement(NEW.user_id, 'FIRST_WIN');
    IF COALESCE(NEW.win_amount, 0) >= 10000 THEN
      PERFORM public._unlock_achievement(NEW.user_id, 'BIG_WIN');
    END IF;
    IF NEW.bet_type = 'TRIPLE_PANA' THEN
      PERFORM public._unlock_achievement(NEW.user_id, 'PANA_MASTER');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ach_on_settle ON public.bets;
CREATE TRIGGER trg_ach_on_settle AFTER UPDATE ON public.bets
  FOR EACH ROW EXECUTE FUNCTION public.check_ach_on_settle();

-- 6) Leaderboard view
CREATE OR REPLACE VIEW public.leaderboard_winnings AS
SELECT
  b.user_id,
  p.username,
  SUM(b.win_amount) FILTER (WHERE b.settled_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')) AS today_won,
  SUM(b.win_amount) FILTER (WHERE b.settled_at >= date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata')) AS week_won,
  SUM(b.win_amount) FILTER (WHERE b.settled_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')) AS month_won
FROM public.bets b
JOIN public.profiles p ON p.user_id = b.user_id
WHERE b.status = 'WON' AND b.win_amount > 0
GROUP BY b.user_id, p.username;

GRANT SELECT ON public.leaderboard_winnings TO anon, authenticated;

-- 7) Starline category on quick rounds
ALTER TABLE public.quick_rounds
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'QUICK';

CREATE INDEX IF NOT EXISTS idx_quick_rounds_cat_status ON public.quick_rounds(category, status);

-- Helper: ensure today's Starline schedule (12 rounds, 1 hr apart, 5-min play window)
CREATE OR REPLACE FUNCTION public.ensure_starline_rounds()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ist TIMESTAMPTZ := now();
  d DATE := (ist AT TIME ZONE 'Asia/Kolkata')::date;
  hours INT[] := ARRAY[10,11,12,13,14,15,16,17,18,19,20,21];
  h INT;
  open_at TIMESTAMPTZ;
  created INT := 0;
BEGIN
  FOREACH h IN ARRAY hours LOOP
    open_at := ((d::TEXT || ' ' || lpad(h::TEXT,2,'0') || ':00:00')::timestamp AT TIME ZONE 'Asia/Kolkata');
    IF open_at < now() - interval '1 hour' THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.quick_rounds
               WHERE category='STARLINE' AND opens_at = open_at) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.quick_rounds(opens_at, closes_at, payout_multiplier, status, category)
    VALUES (open_at, open_at + interval '5 minutes', 9, 'OPEN', 'STARLINE');
    created := created + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'created', created, 'date', d);
END $$;

REVOKE ALL ON FUNCTION public.ensure_starline_rounds() FROM PUBLIC, anon, authenticated;

-- Schedule daily at 09:00 IST = 03:30 UTC
SELECT cron.unschedule('starline-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'starline-daily');
SELECT cron.schedule('starline-daily', '30 3 * * *', $cron$ SELECT public.ensure_starline_rounds(); $cron$);

-- Seed today's Starline rounds immediately
SELECT public.ensure_starline_rounds();
