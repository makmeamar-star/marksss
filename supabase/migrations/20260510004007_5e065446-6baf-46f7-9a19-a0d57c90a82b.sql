
-- payment_channels: deposit-side channels (UPI / BANK / QR)
CREATE TABLE public.payment_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('UPI','BANK','QR')),
  label text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  qr_image_url text,
  instructions text,
  active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  min_amount numeric NOT NULL DEFAULT 100,
  max_amount numeric NOT NULL DEFAULT 100000,
  daily_cap numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active channels"
  ON public.payment_channels FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage channels"
  ON public.payment_channels FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payment_channels_touch
  BEFORE UPDATE ON public.payment_channels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_payment_channels_active ON public.payment_channels (active, priority);

-- withdrawal_methods: which payout types users can pick
CREATE TABLE public.withdrawal_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('UPI','BANK')),
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  min_amount numeric NOT NULL DEFAULT 500,
  max_amount numeric NOT NULL DEFAULT 100000,
  fee_pct numeric NOT NULL DEFAULT 0,
  instructions text,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active withdrawal methods"
  ON public.withdrawal_methods FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage withdrawal methods"
  ON public.withdrawal_methods FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_withdrawal_methods_touch
  BEFORE UPDATE ON public.withdrawal_methods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Public storage bucket for QR images
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-qr', 'payment-qr', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read payment-qr"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-qr');

CREATE POLICY "Admins upload payment-qr"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-qr' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update payment-qr"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'payment-qr' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete payment-qr"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-qr' AND public.has_role(auth.uid(), 'admin'));

-- Seed reasonable defaults so existing flow still works
INSERT INTO public.withdrawal_methods (type, label, min_amount, max_amount, fee_pct, priority)
VALUES
  ('UPI',  'UPI Transfer',           500, 100000, 0, 10),
  ('BANK', 'Bank Account (IMPS/NEFT)', 1000, 500000, 0, 20);
