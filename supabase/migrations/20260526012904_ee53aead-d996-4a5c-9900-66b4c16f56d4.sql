
DROP VIEW IF EXISTS public.active_promo_codes;

-- Recreate as a regular (invoker) view; access governed by RLS below.
CREATE VIEW public.active_promo_codes
WITH (security_invoker = true) AS
SELECT code, description, bonus_amount, min_deposit, expires_at
FROM public.promo_codes
WHERE active = true AND (expires_at IS NULL OR expires_at > now());

GRANT SELECT ON public.active_promo_codes TO authenticated;

-- Re-add a SELECT policy on promo_codes restricted to active rows.
-- Client code only ever selects safe columns; admins keep full access via existing ALL policy.
CREATE POLICY "Authenticated read active promo codes"
ON public.promo_codes
FOR SELECT
TO authenticated
USING (active = true AND (expires_at IS NULL OR expires_at > now()));
