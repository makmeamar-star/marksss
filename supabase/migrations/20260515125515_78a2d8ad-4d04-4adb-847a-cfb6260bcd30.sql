-- Retry queue for markets whose scrape failed transiently.
CREATE TABLE public.scrape_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id text NOT NULL,
  session_date date NOT NULL,
  session text NOT NULL CHECK (session IN ('OPEN','CLOSE')),
  source text NOT NULL,
  slug text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DONE','GIVEN_UP')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_id, session_date, session, source)
);

CREATE INDEX idx_scrape_retry_queue_due
  ON public.scrape_retry_queue (status, next_attempt_at)
  WHERE status = 'PENDING';

ALTER TABLE public.scrape_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read scrape retry queue"
  ON public.scrape_retry_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enqueue (or reset) a retry entry. Service-role only via SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.enqueue_scrape_retry(
  _market_id text,
  _session_date date,
  _session text,
  _source text,
  _slug text,
  _error text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.scrape_retry_queue
    (market_id, session_date, session, source, slug, attempts, next_attempt_at, last_error, status)
  VALUES
    (_market_id, _session_date, _session, _source, _slug, 0, now() + interval '1 minute', _error, 'PENDING')
  ON CONFLICT (market_id, session_date, session, source) DO UPDATE
    SET last_error = EXCLUDED.last_error,
        -- Only reset to PENDING if not already DONE
        status = CASE WHEN scrape_retry_queue.status = 'DONE' THEN 'DONE' ELSE 'PENDING' END,
        next_attempt_at = CASE
          WHEN scrape_retry_queue.status = 'DONE' THEN scrape_retry_queue.next_attempt_at
          ELSE GREATEST(scrape_retry_queue.next_attempt_at, now() + interval '30 seconds')
        END,
        updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_scrape_retry(text, date, text, text, text, text) FROM PUBLIC;

-- Mark an entry's outcome and reschedule.
CREATE OR REPLACE FUNCTION public.update_scrape_retry_outcome(
  _id uuid,
  _success boolean,
  _error text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.scrape_retry_queue%ROWTYPE;
  backoff_minutes integer;
BEGIN
  SELECT * INTO rec FROM public.scrape_retry_queue WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF _success THEN
    UPDATE public.scrape_retry_queue
      SET status = 'DONE',
          attempts = rec.attempts + 1,
          last_error = NULL,
          updated_at = now()
      WHERE id = _id;
    RETURN;
  END IF;

  -- Exponential backoff: 2, 5, 10, 20, 40, 80 minutes
  backoff_minutes := LEAST(80, 2 * power(2, rec.attempts)::int);

  IF rec.attempts + 1 >= rec.max_attempts THEN
    UPDATE public.scrape_retry_queue
      SET status = 'GIVEN_UP',
          attempts = rec.attempts + 1,
          last_error = _error,
          updated_at = now()
      WHERE id = _id;

    INSERT INTO public.system_alerts (source, severity, title, message, context)
    VALUES (
      'scrape-retry-queue',
      'high',
      'Scrape retry exhausted',
      format('Market %s session %s on %s gave up after %s attempts',
             rec.market_id, rec.session, rec.session_date, rec.attempts + 1),
      jsonb_build_object(
        'market_id', rec.market_id,
        'session_date', rec.session_date,
        'session', rec.session,
        'source', rec.source,
        'last_error', _error
      )
    );
  ELSE
    UPDATE public.scrape_retry_queue
      SET attempts = rec.attempts + 1,
          last_error = _error,
          next_attempt_at = now() + (backoff_minutes || ' minutes')::interval,
          updated_at = now()
      WHERE id = _id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_scrape_retry_outcome(uuid, boolean, text) FROM PUBLIC;