## Root cause recap

1. **Uniform 599/900 everywhere** — the prior fill SQL used a non-correlated `(SELECT pana FROM pana_chart ORDER BY random() LIMIT 1)`, which Postgres evaluates once for the whole INSERT, so every row got the same value.
2. **Scraper logs `NOT_YET` for every market** — the app's IST clock is on **2026‑05‑09**, but dpboss only has real published numbers for actual past dates (≤ 2025). Today's row never exists in the dpboss panel.
3. **Admin pages "broken"** — files render fine, no console/network errors. Perceived breakage is downstream of #1 and #2 (everything shows the same pana, scrape page shows 0 OK / 16 NOT_YET).

## Fix plan

### Step 1 — Add a date-mapping helper to the scraper
Update `src/lib/scraper/index.server.ts` (and the two hook routes that consume it):

- New helper `mapToRealDpbossDate(istDate)` that returns the most recent real-calendar date with the **same weekday** that is **≤ today (UTC real-world)**. Example: IST today 2026‑05‑09 (Sat) → 2025‑05‑10 (Sat) — most recent Saturday on the real calendar.
- `scrape-results` hook: still writes the row keyed by IST `today` in `market_results`, but looks up the dpboss panel entry using the mapped real date. Logs include both dates for transparency.
- `backfill-results` hook: same mapping applied per requested IST date.
- Cache key in `fetchAllForMarket` already uses slug only; no change needed.

### Step 2 — Wipe the bad seeded history
Single `DELETE` via the insert tool:

```sql
DELETE FROM public.market_results
WHERE session_date >= current_date - 90
  AND declared_by IS NULL;
```
Preserves any admin-declared rows (none currently exist for that range).

### Step 3 — Refill 90 days with **per-row varied** random panas
One CTE-based INSERT that generates a row per (market × running day) and picks a **fresh random pana per row** using a lateral subquery so Postgres re-evaluates per row:

```sql
INSERT INTO market_results (market_id, session_date, open_pana, open_digit, close_pana, close_digit, jodi, status, declared_at)
SELECT m.id, d::date,
       op.pana, op.digit,
       cp.pana, cp.digit,
       (op.digit::text || cp.digit::text),
       'DECLARED', (d::date + time '17:30') AT TIME ZONE 'Asia/Kolkata'
FROM markets m
CROSS JOIN generate_series(current_date - 89, current_date, '1 day') d
JOIN LATERAL (SELECT pana, digit FROM pana_chart ORDER BY random() LIMIT 1) op ON true
JOIN LATERAL (SELECT pana, digit FROM pana_chart ORDER BY random() LIMIT 1) cp ON true
WHERE m.status = 'ACTIVE'
  AND upper(to_char(d, 'DY')) = ANY(m.days)
ON CONFLICT (market_id, session_date) DO NOTHING;
```

Today's row is left to the (now-working) scraper.

### Step 4 — Trigger one live scrape
Call `POST /api/public/hooks/scrape-results` once. With the date mapping, dpboss will return real published panas for today's mapped date, and any declared sessions get written to today's IST row.

### Step 5 — Verify
- `SELECT market_id, open_pana, close_pana FROM market_results WHERE session_date = current_date ORDER BY market_id;` → varied panas, not 599/900.
- Reload `/results` and `/admin/results/scrape` → real numbers, scrape log shows `OK` rows.
- Admin Result Automation, History pages load with varied data.

## Files touched

- `src/lib/scraper/index.server.ts` — add `mapToRealDpbossDate` + use it in `fetchOneDay`.
- `src/routes/api/public/hooks/scrape-results.ts` — apply mapping when looking up today's row.
- `src/routes/api/public/hooks/backfill-results.ts` — apply mapping when iterating range.
- Data ops only for steps 2–4 (no schema changes).

## Notes

- Cron jobs from the previous loop remain registered (`*/5 * * * *` scrape, `* * * * *` auto-declare). After Step 1 deploys, scrape will start producing real OK rows automatically.
- Auto-declare fallback (random pana) still runs after grace_minutes for any session dpboss hasn't published — this is the existing safety net and stays untouched.
