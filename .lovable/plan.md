## Goal

1. Replace the seeded last-90-day results with real data scraped from dpboss for all 8 markets.
2. Pull today's (2026-05-09 IST) live results.
3. Enable end-to-end results automation (admin toggles on, scraper cron, auto-declare cron).

## Current state (verified)

- 8 ACTIVE markets, all already mapped in `market_source_map` to dpboss with correct slugs.
- `market_results` has 629 rows from 2026-02-08 → 2026-05-08 — all seeded (declared_by = NULL, generated panas). The existing `/api/public/hooks/backfill-results` endpoint skips any row that already has both `open_pana` and `close_pana`, so a plain backfill won't overwrite the seed.
- `market_automation` exists for all 8 markets but every `open_enabled` / `close_enabled` is `false`.
- Hook routes already exist: `scrape-results`, `backfill-results`, `auto-declare-results`. RPC `run_due_auto_declarations` works.
- No cron jobs visible (cron schema not readable via psql, but admin/results pages assume one exists).

## Plan

### Step 1 — Clear seeded last-90-day rows (Supabase migration)
Delete `market_results` rows for `session_date >= today_IST - 90` that have `declared_by IS NULL` (i.e. seed only — preserves any admin-declared rows if present). This is a one-shot data fix.

### Step 2 — Backfill 90 days of real results from dpboss
Call `POST /api/public/hooks/backfill-results` with `{ "from": "<today-90>", "to": "<today>" }`. The existing route iterates every market in `market_source_map`, fetches the dpboss panel, validates panas via `pana_chart`, and upserts into `market_results`. Bets are NOT re-settled (history-only — desired since seeded period had no real bets).

If real dpboss data is missing for the future-dated test calendar (2026), the route will simply write whatever dpboss has and leave gaps; we'll surface counts back to the user.

### Step 3 — Pull today's live results
Call `POST /api/public/hooks/scrape-results` to populate today's row(s). Realtime will refresh the UI.

### Step 4 — Enable automation for all markets
SQL update via the insert tool: `UPDATE market_automation SET open_enabled=true, close_enabled=true, grace_minutes=2`. This turns on auto-declare for every market in the admin Result Automation page.

### Step 5 — Schedule pg_cron jobs (insert tool, not migration)
Two recurring jobs against the stable preview URL:

- `scrape-dpboss-every-5min` — every `*/5 * * * *`, POST `/api/public/hooks/scrape-results` (pulls real panas as soon as dpboss publishes).
- `auto-declare-every-minute` — every `* * * * *`, POST `/api/public/hooks/auto-declare-results` (fallback random pana for any enabled session whose result time + grace has passed and scraper hasn't filled).

Use `apikey: <SUPABASE_ANON_KEY>` header (canonical pattern). Routes are under `/api/public/*` so they bypass auth at the edge.

### Step 6 — Verify
- `SELECT COUNT(*), COUNT(declared_by) FILTER (WHERE declared_by IS NULL) FROM market_results WHERE session_date >= today-90` — confirm coverage.
- Reload admin → Result Automation: all switches ON, "Last run" populating after a minute.
- Reload `/results`: today's panas + 14-day grid populated with real numbers.

## Notes / risks

- dpboss may not have results dated in 2026 (real-world data is 2024/2025). If the scraper returns 0 days for the requested window, we'll either (a) shift the seed-clear to keep history visible or (b) re-seed with realistic-looking panas. I'll report counts after Step 2 and ask before destructive fallback.
- No code/schema changes — only data ops + cron registration. The previous fix for the admin auth flash stays intact.
