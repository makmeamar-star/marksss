# Add bulk markets + core/others toggle

## What you'll see

- **Admin → Markets** gets a new **"Core"** toggle on each row. Core markets show on Home, the Star/Top section, and quick-pick lists. Non-core stay reachable on `/markets` under an "All markets" section.
- **~60 new Matka markets** + **8 Jodi markets** seeded with standard dpboss open/close/result times and weekly off days. Existing 15 core markets are untouched.
- **Auto-results** turned on for every new market that has a known dpboss / sattamatkadpboss / fixresult / galidisawar source. Markets without a known source are seeded with `MANUAL` mode and shown with a "no source" badge in `/admin/results/automation` — you declare those by hand or flip them to `RANDOM`.
- Current 15 core markets in `TOP_MARKET_IDS` stay the core set; the new admin toggle lets you move any market in or out of "core" later without a code change.

## Changes

### 1. Database (one migration)

- `**markets.is_core boolean default false**` — new column. Backfilled to `true` for the existing 15 IDs in `TOP_MARKET_IDS` (kalyan, kalyan_night, milan_day, milan_night, rajdhani_day, rajdhani_night, main_bazar, main_mumbai, time_bazar, sridevi, sridevi_night, madhur_day, madhur_night, kalyan_morning, super_kalyan).
- **Seed `markets**` with the full list below using `ON CONFLICT (id) DO NOTHING` — existing rows (kalyan, sridevi, main_bazar, time_bazar, kalyan_night, sridevi_night, milan_night, rajdhani_night, gali, disawar, faridabad, ghaziabad, etc.) are left alone. New rows seeded with standard dpboss times, default payouts, `min_bet=10`, `max_bet=10000`, `status=ACTIVE`, `is_core=false`.
- **Seed `market_source_map**` with dpboss + 1 backup source per market for everything that exists on those sites. Markets with no known source get no row (auto-declare stays off).
- **Seed `market_automation**` rows for every new market: `open_enabled=true, close_enabled=true, mode='RANDOM', grace_minutes=2` only when a source map exists; otherwise `mode='MANUAL'`, both enables `false`.
- **Schedule pg_cron jobs** if not already present (`*/2` scrape, `*/5` queue, `*/10` auto-declare) — calls hit `/api/public/hooks/*` with the project anon key in an `apikey` header.

### 2. Frontend

- `src/routes/admin/markets.tsx` — add a "Core" Switch column wired to `markets.is_core`. Optimistic update via `supabase.from('markets').update({ is_core })`.
- `src/lib/topMarkets.ts` — switch `TOP_MARKET_IDS` from a hard-coded constant to a hook (`useTopMarkets()`) that reads `markets` where `is_core=true`, falling back to the current hardcoded list on first load (no flash). `splitTopMarkets` / `isTopMarket` keep their signatures and take an `is_core` set instead.
- `src/components/StarMarketsSection.tsx`, `src/routes/markets.tsx`, `src/routes/star.tsx`, `src/routes/index.tsx` — read from the new hook so the toggle takes effect everywhere without further edits.
- `/markets` page: add an "All markets" expander section below the core grid that lists every non-core market.

### 3. Auto-result wiring

No code changes — `src/routes/api/public/hooks/scrape-results.ts` and `record_observation_and_maybe_declare` already iterate every enabled `market_source_map` row.

## Markets being added

### Matka (open/close/result — dpboss standard, IST)

Existing rows (skipped on conflict): kalyan, kalyan_night, milan_day, milan_night, rajdhani_day, rajdhani_night, main_bazar, main_mumbai, time_bazar, sridevi, sridevi_night, madhur_day, madhur_night, kalyan_morning, super_kalyan.

New rows (source = dpboss unless marked NO SRC):

```text
id                       display                  open  close  result  days
kalyan_morning           Kalyan Morning           11:00 12:00  12:15   Mon-Sun        [exists]
milan_morning            Milan Morning            10:15 11:15  11:30   Mon-Sun
madhuri                  Madhuri                  11:30 12:30  12:45   Mon-Sun
rajdhani_morning         Rajdhani Morning         09:30 10:30  10:45   Mon-Sun
sridevi_morning          Sridevi Morning          09:45 10:45  11:00   Mon-Sun
maharani                 Maharani                 12:00 13:00  13:15   Mon-Sun        NO SRC
karnataka_day            Karnataka Day            14:30 16:30  16:45   Mon-Sun        NO SRC
time_bazar_morning       Time Bazar Morning       10:55 11:55  12:10   Mon-Sun
main_sridevi_day         Main Sridevi Day         11:35 12:35  12:50   Mon-Sun
tara_mumbai_day          Tara Mumbai Day          13:30 15:00  15:15   Mon-Sun
prabhat                  Prabhat                  10:15 11:15  11:30   Mon-Sun
diamond                  Diamond                  11:50 12:50  13:05   Mon-Sun
time_bazar_day           Time Bazar Day           13:00 14:00  14:15   Mon-Sun
main_bazar_morning       Main Bazar Morning       11:00 13:00  13:15   Mon-Sun
main_bazar_day           Main Bazar Day           15:00 17:00  17:15   Mon-Sun
puna_bazar               Puna Bazar               13:35 14:35  14:50   Mon-Sun
new_time_bazar           New Time Bazar           12:35 13:35  13:50   Mon-Sun
diamond_night            Diamond Night            20:50 22:50  23:05   Mon-Sun
madhuri_night            Madhuri Night            21:30 23:30  23:45   Mon-Sun
night_time_bazar         Night Time Bazar         20:30 22:30  22:45   Mon-Sun
tara_mumbai_night        Tara Mumbai Night        20:30 22:30  22:45   Mon-Sun
banglore_morning         Banglore Morning         10:00 11:00  11:15   Mon-Sun        NO SRC
banglore_day             Banglore Day             14:00 16:00  16:15   Mon-Sun        NO SRC
banglore_night           Banglore Night           20:00 22:00  22:15   Mon-Sun        NO SRC
main_sridevi             Main Sridevi             20:30 22:30  22:45   Mon-Sun
maharani_day             Maharani Day             12:30 13:30  13:45   Mon-Sun        NO SRC
parel_day                Parel Day                14:00 16:00  16:15   Mon-Sun        NO SRC
bombay_day               Bombay Day               14:30 16:30  16:45   Mon-Sun        NO SRC
shri_devi_day            Shri Devi Day            11:00 12:00  12:15   Mon-Sun        NO SRC
ratan_khatri             Ratan Khatri             20:00 22:00  22:15   Mon-Sun        NO SRC
morning                  Morning                  09:00 10:00  10:15   Mon-Sun        NO SRC
worli_night              Worli Night              21:30 23:30  23:45   Mon-Sun        NO SRC
maharani_night           Maharani Night           21:30 23:00  23:15   Mon-Sun        NO SRC
jay_shree_day            Jay Shree Day            13:30 15:00  15:15   Mon-Sun        NO SRC
sri_dhanalaxmi           Sri Dhanalaxmi           14:00 16:00  16:15   Mon-Sun        NO SRC
bombay_night             Bombay Night             21:30 23:30  23:45   Mon-Sun        NO SRC
sunday_bazar             Sunday Bazar             14:00 16:00  16:15   Sun            NO SRC
padmavathi               Padmavathi               13:00 14:00  14:15   Mon-Sun        NO SRC
padmavathi_night         Padmavathi Night         20:30 22:30  22:45   Mon-Sun        NO SRC
lucky_day                Lucky Day                13:00 14:00  14:15   Mon-Sun        NO SRC
kalyan_sridevi           Kalyan Sridevi           13:30 15:30  15:45   Mon-Sun        NO SRC
kalyan_sridevi_night     Kalyan Sridevi Night     21:00 23:00  23:15   Mon-Sun        NO SRC
central_mumbai           Central Mumbai           15:00 17:00  17:15   Mon-Sun        NO SRC
super_goa_day            Super Goa Day            14:30 16:30  16:45   Mon-Sun        NO SRC
kuber_morning            Kuber Morning            09:30 10:30  10:45   Mon-Sun        NO SRC
mumbai_day               Mumbai Day               14:00 16:00  16:15   Mon-Sun        NO SRC
meena_bazar_day          Meena Bazar Day          14:30 16:30  16:45   Mon-Sun        NO SRC
star_tara_morning        Star Tara Morning        10:30 11:30  11:45   Mon-Sun        NO SRC
star_tara_day            Star Tara Day            14:30 16:30  16:45   Mon-Sun        NO SRC
star_tara_night          Star Tara Night          21:30 23:30  23:45   Mon-Sun        NO SRC
puna_night               Puna Night         20:00 22:00  22:15   Mon-Sun        NO SRC
```

### Jodi (galidisawar-style — single result, no open/close split)

```text
id              display          result_time  source
gali            Gali             23:30        [exists]
disawar         Disawar          05:00        [exists]
ghaziabad       Ghaziabad        21:30        [exists]
faridabad       Faridabad        18:30        [exists]
mohali          Mohali           18:30        https://satta-king-fast.com
delhi_bazar     Delhi Bazar      15:00        https://satta-king-fast.com
shri_ganesh     Shri Ganesh      16:30        https://satta-king-fast.com
rajdhani_jodi   Rajdhani         15:00        https://satta-king-fast.com / NO SRC if missing
```

`shri_ganesh` and `rajdhani_jodi` get seeded but may end up `MANUAL` [if  https://satta-king-fast.com](https://satta-king-fast.com) doesn't list them — happy to verify with a quick scrape before going live if you want.

## What I'm NOT touching

- Existing 15 core markets, their times, sources, payouts.
- Bet flow, settlement, KYC, wallet, RLS.
- Bet limits and payouts for new markets (all inherit the default payouts JSON).

