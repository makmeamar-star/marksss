-- Make handle_new_user idempotent + auto-generate unique usernames
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  base_username TEXT;
  candidate TEXT;
  attempts INT := 0;
  inserted BOOLEAN := FALSE;
BEGIN
  -- Pick a base: explicit meta username -> email local-part -> phone tail -> "user"
  base_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    CASE WHEN NEW.phone IS NOT NULL AND length(NEW.phone) >= 4
         THEN 'u' || right(regexp_replace(NEW.phone, '\D', '', 'g'), 6)
         ELSE NULL END,
    'user'
  );
  -- Sanitize: only [a-z0-9_], lowercase, max 20 chars
  base_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g'));
  IF base_username IS NULL OR length(base_username) < 3 THEN
    base_username := 'user';
  END IF;
  base_username := left(base_username, 20);

  candidate := base_username;
  WHILE NOT inserted AND attempts < 6 LOOP
    BEGIN
      INSERT INTO public.profiles (user_id, username, email, phone, balance, total_deposit)
      VALUES (NEW.id, candidate, NEW.email, NEW.phone, 1000, 1000)
      ON CONFLICT (user_id) DO NOTHING;
      -- Did the row exist already (e.g. resend)? Treat as success.
      IF FOUND OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
        inserted := TRUE;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      attempts := attempts + 1;
      candidate := left(base_username, 14) || '_' || substr(md5(random()::text || NEW.id::text), 1, 5);
    END;
    attempts := attempts + 1;
  END LOOP;

  IF NOT inserted THEN
    -- Last-resort guaranteed-unique fallback
    INSERT INTO public.profiles (user_id, username, email, phone, balance, total_deposit)
    VALUES (NEW.id, 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8), NEW.email, NEW.phone, 1000, 1000)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Role assignment (idempotent)
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;