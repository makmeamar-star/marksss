
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Markets
CREATE TABLE public.markets (
  id text PRIMARY KEY,
  name text NOT NULL,
  display_name text NOT NULL,
  open_time text NOT NULL,
  close_time text NOT NULL,
  result_time text NOT NULL,
  days text[] NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  min_bet numeric NOT NULL DEFAULT 10,
  max_bet numeric NOT NULL DEFAULT 10000,
  payouts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads markets" ON public.markets FOR SELECT USING (true);
CREATE POLICY "Admins write markets" ON public.markets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Market results
CREATE TABLE public.market_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id text NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  open_pana text,
  open_digit smallint,
  close_pana text,
  close_digit smallint,
  jodi text,
  status text NOT NULL DEFAULT 'PENDING',
  declared_at timestamptz,
  declared_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_id, session_date)
);
ALTER TABLE public.market_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads results" ON public.market_results FOR SELECT USING (true);
CREATE POLICY "Admins write results" ON public.market_results
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bets
CREATE TABLE public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id text NOT NULL REFERENCES public.markets(id),
  session_date date NOT NULL,
  session text NOT NULL,
  bet_type text NOT NULL,
  bet_number text NOT NULL,
  amount numeric NOT NULL,
  payout numeric NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  win_amount numeric,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bets_market_session_idx ON public.bets (market_id, session_date, session, status);
CREATE INDEX bets_user_idx ON public.bets (user_id, created_at DESC);
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own bets" ON public.bets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own bets" ON public.bets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'PENDING');
CREATE POLICY "Admins read all bets" ON public.bets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update bets" ON public.bets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETED',
  description text,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_tx_user_idx ON public.wallet_transactions (user_id, created_at DESC);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own wallet tx" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all wallet tx" ON public.wallet_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert wallet tx" ON public.wallet_transactions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  actor_email text,
  action text NOT NULL,
  market_id text,
  session_date date,
  session text,
  pana text,
  previous_pana text,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert audit log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER markets_touch BEFORE UPDATE ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER market_results_touch BEFORE UPDATE ON public.market_results
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed the 8 standard markets
INSERT INTO public.markets (id, name, display_name, open_time, close_time, result_time, days, status, min_bet, max_bet, payouts) VALUES
  ('kalyan','kalyan','Kalyan','15:45','17:45','18:00', ARRAY['MON','TUE','WED','THU','FRI','SAT'],'ACTIVE',10,10000,'{"single":9,"jodi":90,"singlePana":150,"doublePana":300,"triplePana":600,"halfSangam":1000,"fullSangam":10000}'),
  ('main-mumbai','main_mumbai','Main Mumbai','09:00','11:00','12:00', ARRAY['MON','TUE','WED','THU','FRI','SAT','SUN'],'ACTIVE',10,10000,'{"single":9,"jodi":90,"singlePana":150,"doublePana":300,"triplePana":600,"halfSangam":1000,"fullSangam":10000}'),
  ('milan-day','milan_day','Milan Day','12:00','14:00','14:30', ARRAY['MON','TUE','WED','THU','FRI','SAT'],'ACTIVE',10,5000,'{"single":9,"jodi":90,"singlePana":150,"doublePana":300,"triplePana":600,"halfSangam":1000,"fullSangam":10000}'),
  ('milan-night','milan_night','Milan Night','20:00','22:00','22:30', ARRAY['MON','TUE','WED','THU','FRI','SAT'],'ACTIVE',10,5000,'{"single":9,"jodi":90,"singlePana":150,"doublePana":300,"triplePana":600,"halfSangam":1000,"fullSangam":10000}'),
  ('rajdhani-day','rajdhani_day','Rajdhani Day','14:00','16:00','16:30', ARRAY['MON','TUE','WED','THU','FRI','SAT'],'ACTIVE',10,10000,'{"single":9,"jodi":90,"singlePana":150,"doublePana":300,"triplePana":600,"halfSangam":1000,"fullSangam":10000}'),
  ('rajdhani-night','rajdhani_night','Rajdhani Night','21:30','23:30','00:05', ARRAY['MON','TUE','WED','THU','FRI','SAT'],'ACTIVE',10,10000,'{"single":9,"jodi":90,"singlePana":150,"doublePana":300,"triplePana":600,"halfSangam":1000,"fullSangam":10000}'),
  ('time-bazar','time_bazar','Time Bazar','11:00','13:00','13:30', ARRAY['MON','TUE','WED','THU','FRI','SAT'],'ACTIVE',10,10000,'{"single":9,"jodi":90,"singlePana":150,"doublePana":300,"triplePana":600,"halfSangam":1000,"fullSangam":10000}'),
  ('madhur-day','madhur_day','Madhur Day','13:20','15:20','15:30', ARRAY['MON','TUE','WED','THU','FRI','SAT'],'ACTIVE',10,10000,'{"single":9,"jodi":90,"singlePana":150,"doublePana":300,"triplePana":600,"halfSangam":1000,"fullSangam":10000}');
