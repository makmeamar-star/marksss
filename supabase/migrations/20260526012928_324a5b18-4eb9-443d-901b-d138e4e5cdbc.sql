
-- Column-level lockdown: revoke broad SELECT, grant only safe columns to authenticated.
REVOKE SELECT ON public.promo_codes FROM authenticated, anon;
GRANT SELECT (code, description, bonus_amount, min_deposit, expires_at)
  ON public.promo_codes TO authenticated;

-- Admins still need full read access; service_role bypasses anyway.
GRANT SELECT ON public.promo_codes TO service_role;
