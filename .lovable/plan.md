## Goal

Make **dpboss.boston** the only live result source, and purge historical results so only today's and yesterday's rows remain (re-fetched fresh from dpboss.boston).

## 1. Point the scraper at dpboss.boston

`src/lib/scraper/dpboss.server.ts` currently fetches from `https://dpboss.services/panel-chart-record/<slug>.php`. Change the base URL to:

```
https://dpboss.boston/panel-chart-record/<slug>.php
```

(HTML structure on dpboss.boston mirrors dpboss.services — same `<tbody>` panel parser keeps working. If a row breaks, the existing scrape log will surface it.)

No changes to `index.server.ts` source registry — the source key stays `"dpboss"` (it's just the live URL that moves), so all 199 existing `market_source_map` rows keep working.

## 2. Purge historical result data

Run a one-time data cleanup (via the insert tool) keeping only `session_date >= CURRENT_DATE - 1` (today + yesterday, IST):

- `market_results` — delete ~10,863 old rows, keep ~199.
- `result_observations` — delete all rows older than yesterday.
- `result_scrape_log` — delete all rows older than yesterday.
- `result_proof` — delete all rows older than yesterday.
- `audit_log` — delete rows where `session_date < CURRENT_DATE - 1` (keeps non-result admin actions, which have NULL session_date).

**Bets are NOT touched.** Already-settled `bets` rows keep their `win_amount` / `status` / `settled_at` — only the underlying result chart history is wiped. Users still see their own bet history; the public Results page just won't show charts older than yesterday.

## 3. Re-scrape today + yesterday from dpboss.boston

After the URL switch + purge, trigger `/api/public/hooks/scrape-results` once. The existing scraper already iterates today + recent days and writes confirmed panas via `record_observation_and_maybe_declare`.

Note on the confirm-twice rule: with a single source, auto-declare requires **two sightings of the same pana ≥ 4 minutes apart from dpboss** (existing behavior from the previous task). The 5-minute pg_cron schedule satisfies this naturally. Missing-result alerts continue to fire as already wired.

## 4. UI surfaces that show old charts

- `/results` and any "panel chart" pages query `market_results` directly → automatically truncate to the last 2 days after the purge.
- No code change needed there; the empty state already handles "no rows".

## Files touched

- `src/lib/scraper/dpboss.server.ts` — base URL constant.
- One SQL run via the insert tool — purge old rows from 5 tables.
- One manual POST to `/api/public/hooks/scrape-results` to backfill today + yesterday from dpboss.boston.

## One thing to confirm before I run the purge

Deleting old `market_results` is **irreversible** (chart history for all past months is gone). Settled bets stay intact, but the public panel chart will only ever show 2 days going forward. Confirm and I'll execute.
