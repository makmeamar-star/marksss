
# Expand Star Markets + wire auto-result updates

## What you'll see
The "Delhi Markets" / Star section (home, `/star`, `/markets` sticky bar) will list these 15 markets instead of just 4, each with today's live result and a Play CTA:

- Gali, Disawar, Faridabad, Ghaziabad *(existing)*
- Kalyan, Kalyan Night
- Milan Day, Milan Night
- Rajdhani Day, Rajdhani Night
- Sridevi, Sridevi Night
- Main Bazar, Main Mumbai
- Time Bazar
- Madhur Day, Madhur Night

Results auto-refresh from public sources (dpboss + 2 backups) every 2 minutes — no manual declaration needed.

> Note: "Main Mumbai" and "Main Bazar" are two different markets in Matka. I'll add both. If you only want one, tell me which.

## Changes

### 1. Database (one migration)
- **Seed `markets`** rows for all 15 markets above (open/close/result times, days, default payouts, min/max bet). Existing rows are left alone via `ON CONFLICT (id) DO NOTHING`.
- **Seed `market_source_map`** with dpboss slugs for each market + at least one backup source (sattamatkadpboss / fixresult / sattakingvip / galidisawar for the 4 Delhi ones). Multiple sources are required so the "confirm-twice" auto-declare logic actually fires.
- **Schedule pg_cron jobs** (currently no jobs exist):
  - `*/2 * * * *` → POST `/api/public/hooks/scrape-results`
  - `*/5 * * * *` → POST `/api/public/hooks/process-scrape-queue`
  - `*/10 * * * *` → POST `/api/public/hooks/auto-declare-results`
  
  Calls use the project anon key in an `apikey` header (canonical pattern).

### 2. Frontend (3 small edits)
- `src/config/starMarkets.ts` — extend `STAR_MARKET_IDS` to all 15 IDs (preserving the curated display order: Delhi 4 first, then Mumbai mains, then others).
- `src/components/StarMarketsSection.tsx` — keep `lg:grid-cols-4`, add `xl:grid-cols-5` so 15 tiles wrap cleanly; keep horizontal-scroll variant unchanged.
- `src/routes/star.tsx` — update meta title/description so it reads "Top Markets — Kalyan, Milan, Rajdhani, Gali, Disawar…" (SEO).

### 3. No code changes needed for scraping
The scraper (`src/routes/api/public/hooks/scrape-results.ts`) and `record_observation_and_maybe_declare` RPC already iterate every enabled `market_source_map` row — adding rows is enough.

## Technical details

**Market IDs and dpboss slugs** (matching existing `topMarkets.ts` convention with underscores):

| id | display | dpboss slug | backup source · slug |
|---|---|---|---|
| kalyan | Kalyan | kalyan | sattamatkadpboss · kalyan |
| kalyan_night | Kalyan Night | kalyan-night | fixresult · kalyan-night |
| milan_day | Milan Day | milan-day | sattamatkadpboss · milan-day |
| milan_night | Milan Night | milan-night | fixresult · milan-night |
| rajdhani_day | Rajdhani Day | rajdhani-day | sattamatkadpboss · rajdhani-day |
| rajdhani_night | Rajdhani Night | rajdhani-night | fixresult · rajdhani-night |
| sridevi | Sridevi | sridevi | sattamatkadpboss · sridevi |
| sridevi_night | Sridevi Night | sridevi-night | fixresult · sridevi-night |
| main_bazar | Main Bazar | main-bazar | sattamatkadpboss · main-bazar |
| main_mumbai | Main Mumbai | main-mumbai | fixresult · main-mumbai |
| time_bazar | Time Bazar | time-bazar | sattamatkadpboss · time-bazar |
| madhur_day | Madhur Day | madhur-day | sattamatkadpboss · madhur-day |
| madhur_night | Madhur Night | madhur-night | fixresult · madhur-night |

Existing Delhi 4 (`gali`, `disawar`, `faridabad`, `ghaziabad`) get a row added only if missing.

**Why two sources per market:** the auto-declare RPC requires the same OPEN/CLOSE pana to be observed by ≥2 sources (or twice 5+ minutes apart from the same source) before it writes to `market_results`. Mapping a single source means results will be stuck in `AWAITING_CONFIRMATION` indefinitely.

**Layout impact:** 15 tiles at `lg:grid-cols-4` = 4 rows. Adding `xl:grid-cols-5` keeps it to 3 rows on wide screens. Horizontal scroll variant (used in `/markets` sticky bar) auto-handles any count.

## What I'm NOT touching
- Payout rates, min/max bet, KYC, wallet logic — all unchanged.
- The 4 existing Delhi markets keep their current slugs/sources.
- No change to `topMarkets.ts` (curated top-15 in market listings) — that list already includes most of these.
- No change to Render deploy plan from earlier.
