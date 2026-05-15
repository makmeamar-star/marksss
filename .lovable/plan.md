## Goal

Two changes to the results pipeline:

1. **Be conservative about auto-declaring** — only publish a result when we're confident it's correct.
2. **Alert admins (push + in-app banner) for every market still missing today's result past its declare time**, so they can declare it manually.

---

## Heads-up on "2+ source agreement"

You picked "Require agreement from 2+ sources before auto-declaring", but the current setup only has **one source** (`dpboss`) wired up in `market_source_map` for every market. So I can't truly cross-check sources today.

I'll implement the same safety idea using the source we have, and leave a clean hook for adding a second scraper later:

- **Confirm-twice rule**: when the scraper sees a pana for a session, it does **not** declare immediately. It writes a "pending observation" with the value. On the next scrape run (≥ a configurable cooldown, default 4 minutes), if the same source returns the same pana, *then* we call `system_auto_declare`. If it changes, we discard and start over and raise an alert.
- **Drop-in for real 2-source agreement**: the comparator works on `(market_id, session_date, session)` keyed observations, so once a second source is added to `market_source_map` it can vote in the same table and the rule auto-upgrades to "2 distinct sources agree".

If you'd rather I add a second scraper now (e.g. satta-matka-result/sattamatkà mirror) instead of confirm-twice, say so and I'll re-plan.

---

## What gets built

### 1. Database (one migration)

- **`result_observations`** — new table: `(market_id, session_date, session, source, pana, observed_at)`. Unique on the first four columns, value updated on conflict. This is where the scraper records what each source currently shows.
- **`app_settings`** entries: `auto_declare_min_confirmations` (default `2`), `auto_declare_min_age_minutes` (default `4`), `manual_declare_grace_minutes` (default `10`).
- **RPC `record_observation_and_maybe_declare(market_id, session_date, session, source, pana)`** — server-side function that:
  1. Upserts into `result_observations`.
  2. Counts distinct `(source, pana)` agreeing rows for that key, older than `min_age_minutes`.
  3. If `≥ min_confirmations` and the pana is identical across them, calls `system_auto_declare`.
  4. If observations disagree, inserts a `system_alerts` row (severity `warning`, source `scraper-mismatch`).
  5. Returns `{ status: 'DECLARED' | 'AWAITING_CONFIRMATION' | 'MISMATCH' | 'SKIPPED_DECLARED' }`.
- **RPC `find_missing_results(now_ist)`** — returns rows for every market whose `close_time` (or `open_time`) for today has passed by `manual_declare_grace_minutes`, and where `market_results` has no `close_pana`/`open_pana` yet. Used by the alerter.

### 2. Scraper hook change

`src/routes/api/public/hooks/scrape-results.ts`:

- Replace the direct `system_auto_declare` call with `record_observation_and_maybe_declare`.
- Log the returned status into `result_scrape_log` with a new status value `AWAITING_CONFIRMATION` so the admin can see "we saw it once, waiting for confirmation".
- No other behavior change — `NOT_YET` and `FETCH_ERROR` paths stay as-is.

### 3. New "missing result" alerter

New route `src/routes/api/public/hooks/alert-missing-results.ts` (POST):

- Calls `find_missing_results`.
- For each missing `(market_id, session)`:
  - Inserts a `notifications` row for every admin user (so the in-app bell shows it).
  - Sends a Web Push to every push subscription belonging to admins (reuses the existing `push_subscriptions` table and the same VAPID send helper used in `dispatch-result-push.ts`). Body: "Kalyan close result missing — tap to declare". Link: `/admin/results/declare?market=<id>&session=<close>`.
  - Dedupes by writing a `system_alerts` row with key `missing-result:<market>:<date>:<session>` and skipping if one already exists for today (prevents push storms).
- Schedule: pg_cron, every 5 minutes from 09:00–01:00 IST.

### 4. Admin UI nudges (small, non-disruptive)

- **Badge on Results menu** (in admin sidebar): red dot with count of today's missing markets. Driven by a new server fn `getMissingResultsCount` calling `find_missing_results`. Polls every 60s.
- **Banner on `/admin` and `/admin/results/declare`**: lists the missing markets with a "Declare now" link that pre-selects market + session in the existing declare form. Same data source as the badge.
- No design changes elsewhere.

### 5. Cron wiring (one `supabase--insert` after migration is approved)

- Re-confirm `cron.schedule` for the existing scrape job runs every 2 minutes (already does).
- Add `cron.schedule('alert-missing-results', '*/5 * * * *', ...)` calling the new endpoint with the project anon key.

---

## Files

**New**
- `src/routes/api/public/hooks/alert-missing-results.ts`
- `src/lib/missingResults.functions.ts` (server fn `getMissingResultsCount`, `getMissingResultsList`)
- `src/components/admin/MissingResultsBanner.tsx`

**Edited**
- `src/routes/api/public/hooks/scrape-results.ts` — switch to new RPC, add `AWAITING_CONFIRMATION` log status.
- `src/components/admin/AdminSidebar.tsx` (or wherever the Results nav item lives) — add badge.
- `src/routes/admin/results.declare.tsx` — render `MissingResultsBanner` at top; respect `?market=&session=` query to pre-fill.

**Migration (one file)** — table, settings rows, two RPCs.

---

## Open question

If you want a real second source instead of the confirm-twice rule, tell me which one (e.g. `dpbossattamatka.com`, `satta-matka-result.com`) and I'll add a scraper module + a second `market_source_map` row per market in the same plan.