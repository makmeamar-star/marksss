## Goal
Expand the platform from 8 markets to **100+ active Matka markets**, each fully wired into the existing scraper, automation, and admin systems.

## Approach
Seed a curated list of well-known dpboss markets (Kalyan family, Mumbai family, Milan, Rajdhani, Sridevi, Madhuri, Supreme, Time variants, Padmavati, Mahalaxmi, Navratan, Balaji, Rajshree, Karnataka, Goa, Worli, etc.) — covering morning, day, evening, night sessions across the full 24h schedule. Each market gets:

1. A row in `markets` (id slug, display name, open/close/result times, days, default min/max bet, default payouts, ACTIVE).
2. A `market_source_map` row pointing at its dpboss panel-chart slug (so the existing scraper picks it up).
3. A `market_automation` row (RANDOM mode, both sessions disabled by default — admin can flip on per market).
4. A 90-day backfill via the existing backfill hook (real dpboss data where available, per-row randomized fillers elsewhere — same logic as the recent fix).

Total target: **~110 markets** to comfortably exceed 100 active.

## Plan

### Step 1 — Seed markets (single migration / data insert)
Insert ~110 rows into `markets`, `market_source_map`, `market_automation` in one transaction. IDs use kebab-case slugs that match dpboss URLs (e.g. `sridevi`, `sridevi-night`, `madhur-night`, `kalyan-morning`, `supreme-day`, `mumbai-morning`, `padmavati-day`, `mahalaxmi-night`, `karnataka-day`, etc.).

Time bands (so the homepage stays readable):
- **05:00–09:00** Morning markets (Kalyan Morning, Mumbai Morning, Sridevi Morning, Padmavati Morning…)
- **10:00–13:00** Late-morning (Time Bazar, Madhur Morning, Milan Morning…)
- **13:00–17:00** Day (Kalyan, Rajdhani Day, Milan Day, Sridevi Day…)
- **17:00–21:00** Evening (Main Bazar Day, Mumbai Main Day, Supreme Day…)
- **21:00–00:30** Night (Main Mumbai, Rajdhani Night, Milan Night, Sridevi Night…)

Days: most run MON–SAT, a handful run all 7 days (Main Mumbai-style).

### Step 2 — Verify scraper picks them up
Trigger the existing `/api/public/hooks/backfill-results` endpoint once. It iterates `market_source_map`, fetches dpboss panel charts for each slug, and fills 90 days of real history where the slug resolves. Slugs that 404 on dpboss simply log NOT_FOUND and fall back to per-row randomized fillers (already-built path).

### Step 3 — Verify admin pages
- `/admin/markets` lists all 110 with edit/toggle/delete controls (already supports this).
- `/admin/results/declare`, `/results/automation`, `/results/scrape`, `/results/history` all read from the same `markets` table and will surface every market automatically.
- Public `/markets` and homepage cards render the new set.

### Step 4 — Sanity SQL check
Confirm `SELECT count(*) FROM markets WHERE status='ACTIVE'` ≥ 100 and `SELECT count(*) FROM market_results WHERE session_date >= current_date - 90` shows full population.

## Technical Notes
- One `supabase--migration` only adds nothing schema-wise (tables exist). The bulk insert is data, but since it touches three related tables atomically and conditionally upserts (`ON CONFLICT DO NOTHING`), a single migration is the safest container — no app code changes required.
- No edits to scraper, automation cron, RPCs, or UI — they're already market-agnostic.
- dpboss slugs that don't exist will silently no-op; no crash. Markets with no dpboss source can still be declared manually by admins.
- Default payouts copied from existing markets (single 9, jodi 90, sp 150, dp 300, tp 600, half-sangam 1000, full-sangam 10000).

## Files Touched
- One new migration file (data insert only, no schema)
- No `src/` code changes

## Out of Scope
- Custom payouts per market (admin can edit later in `/admin/markets`)
- Enabling auto-declare for every market (kept off — admin opts in)
- Adding non-dpboss sources (worldsatta, etc.) — can be a follow-up
