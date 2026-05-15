-- Allow anonymous visitors to read only the demo_login_enabled flag from app_settings
CREATE POLICY "Anyone reads demo_login flag"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key = 'demo_login_enabled');

-- Seed default value (enabled)
INSERT INTO public.app_settings (key, value)
VALUES ('demo_login_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Promote lafxnga@gmail.com to admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('254b681e-fe0f-4b17-816d-b5412bad36d6', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;