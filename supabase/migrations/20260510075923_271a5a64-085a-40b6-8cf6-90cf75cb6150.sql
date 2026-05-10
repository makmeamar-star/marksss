
-- ============ KYC =============
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier smallint NOT NULL DEFAULT 1 CHECK (tier IN (1,2)),
  full_name text,
  pan_masked text,
  dob date,
  address text,
  doc_urls text[] NOT NULL DEFAULT '{}',
  selfie_url text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','MORE_INFO')),
  reviewer_id uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kyc_user ON public.kyc_submissions(user_id);
CREATE INDEX idx_kyc_status ON public.kyc_submissions(status);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own kyc" ON public.kyc_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own kyc" ON public.kyc_submissions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'PENDING');
CREATE POLICY "Users update own pending kyc" ON public.kyc_submissions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('PENDING','MORE_INFO'))
  WITH CHECK (user_id = auth.uid() AND status IN ('PENDING','MORE_INFO'));
CREATE POLICY "Admins read all kyc" ON public.kyc_submissions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update kyc" ON public.kyc_submissions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ CONSENTS =============
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (consent_type IN ('AGE_18','TERMS','PRIVACY','RESPONSIBLE_GAMING','MARKETING')),
  version text NOT NULL,
  accepted boolean NOT NULL DEFAULT true,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_consents_user ON public.user_consents(user_id, consent_type);
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own consents" ON public.user_consents
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own consents" ON public.user_consents
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all consents" ON public.user_consents
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ LIMITS =============
CREATE TABLE public.user_limits (
  user_id uuid PRIMARY KEY,
  daily_bet_limit numeric,
  weekly_bet_limit numeric,
  daily_deposit_limit numeric,
  session_minutes_limit integer,
  reality_check_minutes integer DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own limits" ON public.user_limits
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users upsert own limits" ON public.user_limits
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own limits" ON public.user_limits
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all limits" ON public.user_limits
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ SELF EXCLUSION =============
CREATE TABLE public.self_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('COOLOFF_24H','COOLOFF_7D','COOLOFF_30D','EXCLUDE_PERMANENT')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_se_user_active ON public.self_exclusions(user_id, active);
ALTER TABLE public.self_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own exclusions" ON public.self_exclusions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own exclusions" ON public.self_exclusions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all exclusions" ON public.self_exclusions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ RESULT PROOF =============
CREATE TABLE public.result_proof (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid,
  market_id text,
  session_date date,
  session text,
  server_seed_hash text NOT NULL,
  server_seed text,
  client_seed text,
  nonce bigint,
  result text NOT NULL,
  revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_proof_round ON public.result_proof(round_id);
CREATE INDEX idx_proof_market_date ON public.result_proof(market_id, session_date);
ALTER TABLE public.result_proof ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads proofs" ON public.result_proof FOR SELECT USING (true);

-- ============ STORAGE BUCKET FOR KYC =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own kyc docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own kyc docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins read all kyc docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-docs' AND has_role(auth.uid(), 'admin'::app_role));

-- ============ HELPER RPCs =============

-- Log a consent record (player-callable, validates self-only)
CREATE OR REPLACE FUNCTION public.log_consent(_type text, _version text, _ua text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.user_consents(user_id, consent_type, version, accepted, user_agent)
  VALUES (auth.uid(), _type, _version, true, _ua)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_consent(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_consent(text,text,text) TO authenticated;

-- Set user limits (upsert)
CREATE OR REPLACE FUNCTION public.set_user_limits(
  _daily_bet numeric DEFAULT NULL,
  _weekly_bet numeric DEFAULT NULL,
  _daily_deposit numeric DEFAULT NULL,
  _session_min integer DEFAULT NULL,
  _reality_check_min integer DEFAULT NULL
) RETURNS public.user_limits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.user_limits;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.user_limits(user_id, daily_bet_limit, weekly_bet_limit, daily_deposit_limit, session_minutes_limit, reality_check_minutes)
  VALUES (auth.uid(), _daily_bet, _weekly_bet, _daily_deposit, _session_min, COALESCE(_reality_check_min, 30))
  ON CONFLICT (user_id) DO UPDATE SET
    daily_bet_limit = COALESCE(EXCLUDED.daily_bet_limit, public.user_limits.daily_bet_limit),
    weekly_bet_limit = COALESCE(EXCLUDED.weekly_bet_limit, public.user_limits.weekly_bet_limit),
    daily_deposit_limit = COALESCE(EXCLUDED.daily_deposit_limit, public.user_limits.daily_deposit_limit),
    session_minutes_limit = COALESCE(EXCLUDED.session_minutes_limit, public.user_limits.session_minutes_limit),
    reality_check_minutes = COALESCE(EXCLUDED.reality_check_minutes, public.user_limits.reality_check_minutes),
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_user_limits(numeric,numeric,numeric,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_limits(numeric,numeric,numeric,integer,integer) TO authenticated;

-- Start self-exclusion
CREATE OR REPLACE FUNCTION public.start_self_exclusion(_kind text)
RETURNS public.self_exclusions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ends timestamptz;
  _row public.self_exclusions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _ends := CASE _kind
    WHEN 'COOLOFF_24H' THEN now() + interval '24 hours'
    WHEN 'COOLOFF_7D'  THEN now() + interval '7 days'
    WHEN 'COOLOFF_30D' THEN now() + interval '30 days'
    WHEN 'EXCLUDE_PERMANENT' THEN NULL
    ELSE NULL
  END;

  -- Deactivate prior active rows
  UPDATE public.self_exclusions SET active = false
   WHERE user_id = auth.uid() AND active = true;

  INSERT INTO public.self_exclusions(user_id, kind, ends_at, active)
  VALUES (auth.uid(), _kind, _ends, true)
  RETURNING * INTO _row;

  -- If permanent, suspend the account
  IF _kind = 'EXCLUDE_PERMANENT' THEN
    UPDATE public.profiles SET status = 'SUSPENDED' WHERE user_id = auth.uid();
  END IF;
  RETURN _row;
END $$;
REVOKE EXECUTE ON FUNCTION public.start_self_exclusion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_self_exclusion(text) TO authenticated;

-- Submit / resubmit KYC
CREATE OR REPLACE FUNCTION public.submit_kyc(
  _tier smallint,
  _full_name text,
  _pan_masked text,
  _dob date,
  _address text,
  _doc_urls text[],
  _selfie_url text
) RETURNS public.kyc_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.kyc_submissions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Mark any prior pending row of same tier as superseded
  UPDATE public.kyc_submissions
     SET status = 'REJECTED', reviewer_notes = COALESCE(reviewer_notes,'') || ' [auto-superseded]', updated_at = now()
   WHERE user_id = auth.uid() AND tier = _tier AND status IN ('PENDING','MORE_INFO');

  INSERT INTO public.kyc_submissions(user_id, tier, full_name, pan_masked, dob, address, doc_urls, selfie_url, status)
  VALUES (auth.uid(), _tier, _full_name, _pan_masked, _dob, _address, COALESCE(_doc_urls,'{}'), _selfie_url, 'PENDING')
  RETURNING * INTO _row;
  RETURN _row;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_kyc(smallint,text,text,date,text,text[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc(smallint,text,text,date,text,text[],text) TO authenticated;

-- Admin review KYC
CREATE OR REPLACE FUNCTION public.review_kyc(_kyc_id uuid, _decision text, _notes text DEFAULT NULL)
RETURNS public.kyc_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.kyc_submissions;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _decision NOT IN ('APPROVED','REJECTED','MORE_INFO') THEN RAISE EXCEPTION 'Bad decision'; END IF;
  UPDATE public.kyc_submissions
     SET status = _decision,
         reviewer_id = auth.uid(),
         reviewer_notes = _notes,
         reviewed_at = now(),
         updated_at = now()
   WHERE id = _kyc_id
   RETURNING * INTO _row;

  IF _decision = 'APPROVED' THEN
    UPDATE public.profiles SET kyc_status = 'APPROVED' WHERE user_id = _row.user_id;
  END IF;
  RETURN _row;
END $$;
REVOKE EXECUTE ON FUNCTION public.review_kyc(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_kyc(uuid,text,text) TO authenticated;
