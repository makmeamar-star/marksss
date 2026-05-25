DROP POLICY IF EXISTS "Anyone reads demo_login flag" ON public.app_settings;
CREATE POLICY "Anyone reads public settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key IN ('demo_login_enabled', 'support_contacts'));