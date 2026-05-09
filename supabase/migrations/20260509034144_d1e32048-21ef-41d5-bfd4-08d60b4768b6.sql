
CREATE TABLE public.client_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  user_email TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  source TEXT NOT NULL DEFAULT 'react',
  url TEXT,
  route TEXT,
  user_agent TEXT,
  app_version TEXT,
  context JSONB
);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert error reports
CREATE POLICY "Anyone can report errors"
ON public.client_errors
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can read error reports
CREATE POLICY "Admins read errors"
ON public.client_errors
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_client_errors_created_at ON public.client_errors (created_at DESC);
CREATE INDEX idx_client_errors_user_id ON public.client_errors (user_id);
