# Next Version Plan — "Trust & Polish"

Theme: make results **provably correct**, finish the half-built multi-source scraper, and tighten the highest-friction screens. Medium scope (~1 week).

Defaults chosen for you: focus = Result accuracy + Admin tooling + UX polish. Wallet/payments and new game types are deferred to the version after.

---

## 1. Result correctness (P0 — from `.lovable/plan.md`)

The biggest open risk. Today the DB still has markets in `RANDOM` automation mode and the auto-declare scheduler can publish a random pana when scraping is silent.

- **Kill random auto-declare**
  - Migrate all `market_automation` rows off `RANDOM` mode → `SCRAPER_ONLY`.
  - Patch `run_due_auto_declarations` to refuse to publish unless a confirmed observation exists. No fallback to `pana_chart` random pick.
- **Enforce true 2-source agreement**
  - Update `record_observation_and_maybe_declare` so `system_auto_declare` only fires when **≥2 distinct source names** report the same pana for that market/session/date.
  - Remove the "same source seen twice over time" loophole.
  - On conflict → write `CONFLICT` row to `scraper_alerts`, do not publish.
- **Wire the already-scaffolded sources**
  - `sattamatkadpboss`, `fixresult`, `sattakingvip`, `galidisawar` parser files exist (`src/lib/scraper/*.server.ts`) but most markets aren't mapped. Build a source-map seeder and populate `market_source_map` for every active market that has strong slug matches on ≥2 sources.
  - Mark Gali / Disawar / Faridabad / Ghaziabad to use `satta-king-fast.com` + `a1-sattaking.com` (per existing plan note) as their 2 sources.
- **Coverage report in admin**
  - New panel on `/admin/results.scrape` showing per-market: `AUTO_READY` (2+ mapped), `NEEDS_SECOND_SOURCE`, `CONFLICT`, `MANUAL_ONLY`. Drives what to fix next.

## 2. Admin tooling polish (P1)

- **Missing-results dashboard**: today's markets past close-time with no result → one-click "Declare" or "Mark Cancelled". Hook into existing `MissingResultsBanner`.
- **One-click correct**: extend `CorrectResultDialog` to also re-settle bets atomically and write an `audit_log` with before/after values.
- **Scrape queue health**: surface last-success-per-source, failure rate 24h, and a "re-run now" button per market.

## 3. UX polish (P1)

- **Login speed fix follow-up**: the prior turn fixed the multi-click login, but auth bootstrap still gates the whole tree. Add an optimistic skeleton on protected routes so the first paint is instant.
- **Result reveal cohesion**: ensure `NumberReveal` and `ResultCard` share one size scale after the recent shrink pass; remove any leftover `text-2xl/3xl` on markets/index/results pages.
- **Offline + stale-result indicator**: small chip on `ResultCard` when the row is older than expected close-time + 15m and unconfirmed.

## 4. Reliability (P2)

- **Fix runtime React #418** currently reported (hydration mismatch). Audit any `Date.now()` / `new Date()` rendered directly into JSX in route components; move into `useEffect` or `suppressHydrationWarning`.
- **PWA**: bump `sw.js` cache version on each build so users get fresh JS without a hard reload.

---

## Technical notes

- DB migrations: 1 to flip automation modes, 1 to harden `system_auto_declare` and `record_observation_and_maybe_declare`, 1 to seed `market_source_map`.
- New server fn: `getScraperCoverage` in `src/lib/scraperObservations.functions.ts`.
- New parsers if needed: `satta-king-fast.server.ts`, `a1-sattaking.server.ts` registered in `src/lib/scraper/index.server.ts` under `SourceName`.
- No new external dependencies. No payment/wallet changes. No new game types.

## Out of scope (next version after this)

- Razorpay/UPI gateway, KYC automation
- Starline rework, new bet types, live in-play
- Referral revamp, push notification campaigns

---

Reply with anything you want added/removed, or hit **Implement plan** to start.