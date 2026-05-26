# Expand `/jodi` to all 8 Jodi markets

All 8 markets you listed already exist in the database with auto-result scraping enabled (source: sattaking.in via the `galidisawar` scraper). The only thing missing is that `src/routes/jodi.tsx` currently hardcodes just 4 IDs (`gali, disawar, faridabad, ghaziabad`), so the other 4 are invisible on the Jodi page.

## What changes

**`src/routes/jodi.tsx`** — extend the market list:

```ts
const JODI_MARKET_IDS = [
  "gali", "disawar", "faridabad", "ghaziabad",
  "mohali", "delhi_bazar", "shri_ganesh", "rajdhani_jodi",
] as const;
```

Grid already collapses to `sm:grid-cols-2 lg:grid-cols-4` — 8 cards lay out as 2 rows on desktop, no layout work needed.

**Previous-result fallback** — already wired. The page reads:
```ts
const r = results.find(x => x.marketId === m.id && x.sessionDate === today)
       ?? latestPerMarket[m.id];
```
So if today's result isn't declared yet, the card shows the most recent declared Jodi from `useLatestResultsPerMarket()`. We'll add a tiny `"(yesterday)"` / date label under the number when falling back, so users can tell it's not today's number.

**Auto-result** — no change needed. All 8 markets already have:
- `market_automation.mode = RANDOM`, both open/close enabled
- `market_source_map` row pointing at the `galidisawar` (sattaking.in) scraper
- The existing `pg_cron` scrape + auto-declare jobs already iterate every enabled source row

## Out of scope

- No DB migrations (markets, sources, automation already seeded).
- No scraper code changes — `src/lib/scraper/galidisawar.server.ts` already handles `mohali`, `delhi_bazar`, `shri_ganesh`, `rajdhani` slugs if sattaking.in lists them; if a site doesn't list one on a given day, the card falls back to the last declared result, which is exactly the behavior you asked for.
- Other pages (Home, /markets, admin) already read from `markets` table dynamically and already include these markets.
