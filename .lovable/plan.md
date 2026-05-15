To me, “update only correct result” means: the app must not publish/settle any result unless the same market/session/date result is confirmed by at least 2 independent sources. If sources disagree or only one source has a value, keep it pending and show it to admin for manual review.

Current findings:

- The biggest risk is not only dpboss.boston. Your database currently has all 117 markets in `RANDOM` automation mode, and the scheduled `auto-declare-results` path can publish random panas after market time. That can create incorrect live results even when scraping is broken.
- The existing 2-source confirmation function exists, but it is weakened by the random auto-declare scheduler and by having only one real scraper source wired.
- I checked `https://sattamatkadpboss.mobi/`: it has many live results on the homepage, but I did not find Gali, Disawar, Faridabad, or Ghaziabad there.
- I checked `https://www.fixresult.in/`: its public data API currently exposes around 18 markets; I did not find Gali, Disawar, Faridabad, or Ghaziabad there either.

Plan:

1. Stop incorrect/random result publishing

- Disable or neutralize the random auto-declare scheduler so it cannot publish fake/random results.
- Update `run_due_auto_declarations` so it does not randomly select a pana from `pana_chart` for live markets.
- Keep manual admin declaration available for markets that are not covered by reliable sources.

2. Add multi-source real result scrapers

- Add a `sattamatkadpboss` source parser for `https://sattamatkadpboss.mobi/` live homepage result cards.
- Add a `fixresult` source parser using FixResult’s public JSON data API, matching the way their own homepage loads results.
- Keep the existing `dpboss` parser, but do not allow it alone to auto-publish.

3. Enforce true 2+ source agreement before publishing

- Require at least 2 distinct source names reporting the same pana before `record_observation_and_maybe_declare` can call `system_auto_declare`.
- Remove/disable the current fallback where the same source seen twice over time can count as 2 confirmations.
- If sources conflict, create a warning and keep the result unpublished.

4. Update market source mapping

- Add source-map rows for markets that are available on the new sources with the correct source slug/name.
- Use strong matching only; do not guess ambiguous names like `main-mumbai` vs `main-bazar`.
- Leave unsupported/uncertain markets unmapped so they do not auto-publish incorrectly.

5. Improve admin visibility

- Add a source coverage report in the scraper/admin page showing:
  - markets confirmed by 2+ sources,
  - markets found on only 1 source,
  - markets not found on the checked sources,
  - conflicting source values.
- Add clear labels: `AUTO_READY`, `NEEDS_SECOND_SOURCE`, `CONFLICT`, `MANUAL_ONLY`.

6. Recheck and report unavailable markets

- After wiring parsers, run a fresh comparison against your active markets.
- Provide you a list of markets not available on `sattamatkadpboss.mobi` or `fixresult.in` so you can delete them, add another source, or publish manually.
- Based on my initial check, these priority markets are not available on either suggested source: Gali, Disawar, Faridabad, Ghaziabad, and Desawar Special.

Technical details:

- Files likely touched: scraper source modules, scraper coordinator, scrape hooks, queue processor, admin scraper page.
- Database changes: update the confirmation RPC to require distinct sources only, and neutralize random auto-declare behavior.
- Data changes: update existing automation/source-map rows after the database function changes are approved.
- No private API keys are needed for these two sources; FixResult’s data access is already public from their frontend script. 

For gali disawar faridabad gaziabad use [https://satta-king-fast.com/](https://satta-king-fast.com/)  [https://a1-sattaking.com/chart-2026/faridabad-satta-result](https://a1-sattaking.com/chart-2026/faridabad-satta-result)