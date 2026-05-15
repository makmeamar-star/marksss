
-- 1. Stop ALL auto-generated (random) result publishing going forward
UPDATE public.market_automation
SET mode = 'SCRAPE',
    open_enabled = false,
    close_enabled = false,
    updated_at = now();

-- 2. Revert + delete today's results that weren't confirmed by a real scrape
DO $$
DECLARE
  _r RECORD;
  _bet RECORD;
  _balance_before NUMERIC;
BEGIN
  FOR _r IN
    SELECT mr.market_id, mr.session_date
    FROM public.market_results mr
    WHERE mr.session_date = CURRENT_DATE
      AND mr.status = 'DECLARED'
      AND NOT EXISTS (
        SELECT 1 FROM public.result_scrape_log l
        WHERE l.market_id = mr.market_id
          AND l.session_date = mr.session_date
          AND l.status = 'OK'
      )
  LOOP
    -- Refund winners and reset bets touching this market/date
    FOR _bet IN
      SELECT * FROM public.bets
      WHERE market_id = _r.market_id
        AND session_date = _r.session_date
        AND status IN ('WON','LOST')
      FOR UPDATE
    LOOP
      IF _bet.status = 'WON' AND _bet.win_amount IS NOT NULL AND _bet.win_amount > 0 THEN
        SELECT balance INTO _balance_before
        FROM public.profiles WHERE user_id = _bet.user_id FOR UPDATE;

        INSERT INTO public.wallet_transactions
          (user_id, type, amount, balance_before, balance_after, status, description, reference_id)
        VALUES
          (_bet.user_id, 'CORRECTION_REVERSAL', -(_bet.win_amount),
           _balance_before, _balance_before - _bet.win_amount,
           'COMPLETED',
           'Reversal: auto-generated result removed (' || _bet.bet_type || ' ' || _bet.bet_number || ')',
           _bet.id::TEXT);

        UPDATE public.profiles
        SET balance = balance - _bet.win_amount,
            total_win = greatest(0, total_win - _bet.win_amount)
        WHERE user_id = _bet.user_id;
      END IF;

      UPDATE public.bets
      SET status = 'PENDING',
          win_amount = NULL,
          settled_at = NULL
      WHERE id = _bet.id;
    END LOOP;

    -- Delete the auto-generated result and its audit/observations
    DELETE FROM public.audit_log
     WHERE market_id = _r.market_id
       AND session_date = _r.session_date
       AND action = 'AUTO_DECLARE';

    DELETE FROM public.result_observations
     WHERE market_id = _r.market_id
       AND session_date = _r.session_date;

    DELETE FROM public.market_results
     WHERE market_id = _r.market_id
       AND session_date = _r.session_date;
  END LOOP;
END $$;
