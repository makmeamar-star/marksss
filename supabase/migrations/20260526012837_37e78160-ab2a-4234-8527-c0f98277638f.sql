
-- 1. Restrict promo_codes exposure: drop broad authenticated SELECT, expose only safe fields via a view
DROP POLICY IF EXISTS "Anyone reads active promo codes" ON public.promo_codes;

CREATE OR REPLACE VIEW public.active_promo_codes
WITH (security_invoker = false) AS
SELECT code, description, bonus_amount, min_deposit, expires_at
FROM public.promo_codes
WHERE active = true AND (expires_at IS NULL OR expires_at > now());

GRANT SELECT ON public.active_promo_codes TO authenticated;

-- 2. Tighten client_errors INSERT: anon must have null user_id/email; authenticated must match auth.uid
DROP POLICY IF EXISTS "Anyone can report errors" ON public.client_errors;

CREATE POLICY "Anon can report errors without identity"
ON public.client_errors
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND user_email IS NULL
  AND length(COALESCE(message,'')) BETWEEN 1 AND 4000
  AND length(COALESCE(stack,'')) <= 8000
  AND length(COALESCE(url,'')) <= 2000
  AND length(COALESCE(route,'')) <= 500
  AND length(COALESCE(user_agent,'')) <= 500
);

CREATE POLICY "Authed users report own errors"
ON public.client_errors
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND length(COALESCE(message,'')) BETWEEN 1 AND 4000
  AND length(COALESCE(stack,'')) <= 8000
  AND length(COALESCE(url,'')) <= 2000
  AND length(COALESCE(route,'')) <= 500
  AND length(COALESCE(user_agent,'')) <= 500
);

-- 3. Storage cleanup policies for private buckets
CREATE POLICY "Admins delete kyc docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kyc-docs' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update kyc docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-docs' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'kyc-docs' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete payment screenshots"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-screenshots' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update payment screenshots"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-screenshots' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'payment-screenshots' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own payment screenshots"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own kyc docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kyc-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
