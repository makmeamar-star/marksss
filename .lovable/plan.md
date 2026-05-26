## Goal

Make Ghaziabad, Faridabad, Gali, Disawar, Mohali, Delhi Bazar, Shri Ganesh, and Rajdhani Jodi behave as Jodi + Single only (no Pana, no Sangam), keep auto-results running for them, and give you a clear list of which markets have auto-results vs which don't.

## 1. DB migration — flag the 8 markets as Jodi-only

Set `is_jodi_only = true` for: `ghaziabad`, `faridabad`, `gali`, `disawar`, `mohali`, `delhi_bazar`, `shri_ganesh`, `rajdhani_jodi`.

Their `market_automation` rows already have `open_enabled = true` and `close_enabled = true`, and all 8 are wired to the `galidisawar` scraper source — so auto-declaration is already active. No automation change needed.

## 2. Expose the flag in the app

- `src/lib/types.ts` — add `isJodiOnly?: boolean` to `Market`.
- `src/hooks/useGameData.ts` — map `r.is_jodi_only` → `isJodiOnly` alongside `isCore`.

## 3. Hide Pana / Half Sangam / Full Sangam on Jodi-only markets

`src/routes/_authenticated/bet.$marketId.tsx` — when `market.isJodiOnly`:
- Render only the **Single** and **Jodi** tabs in `TabsList`.
- Drop the `TabsContent` for `pana`, `halfsangam`, `fullsangam`.
- Keep the existing session/cutoff logic untouched.

The standalone `/jodi/$marketId` route is already Jodi-only and needs no change.

## 4. Auto-results coverage report

You don't need new UI — your existing **Admin → Result Automation** page already shows per-market toggles. For convenience, here is the current state from your DB:

**Auto-results ENABLED (44 markets)** — already declaring automatically:
Delhi Bazar, Diamond, Diamond Night, Disawar, Faridabad, Gali, Ghaziabad, Kalyan, Kalyan Morning, Kalyan Night, Madhur Day, Madhur Night, Madhuri, Madhuri Night, Main Bazar, Main Bazar Day, Main Bazar Morning, Main Mumbai, Main Sridevi, Main Sridevi Day, Milan Day, Milan Morning, Milan Night, Mohali, New Time Bazar, Night Time Bazar, Prabhat, Puna Bazar, Puna Night, Rajdhani Day, Rajdhani Jodi, Rajdhani Morning, Rajdhani Night, Shri Ganesh, Sridevi, Sridevi Morning, Sridevi Night, Super Kalyan, Tara Mumbai Day, Tara Mumbai Night, Time Bazar, Time Bazar Day, Time Bazar Morning.

**Auto-results DISABLED / no scraper source (29 markets)** — candidates to deactivate or delete:
Banglore Day, Banglore Morning, Banglore Night, Bombay Day, Bombay Night, Central Mumbai, Jay Shree Day, Kalyan Sridevi, Kalyan Sridevi Night, Karnataka Day, Kuber Morning, Lucky Day, Maharani, Maharani Day, Maharani Night, Meena Bazar Day, Morning, Mumbai Day, Padmavathi, Padmavathi Night, Parel Day, Ratan Khatri, Shri Devi Day, Sri Dhanalaxmi, Star Tara Day, Star Tara Morning, Star Tara Night, Sunday Bazar, Super Goa Day, Worli Night.

After you implement the plan, tell me which of the 29 to deactivate (sets `status = 'INACTIVE'`, keeps history) or delete (removes the row), and I'll prepare that migration.

## Files touched

```
supabase/migrations/<ts>_jodi_only_markets.sql   (new)
src/lib/types.ts                                  (edit)
src/hooks/useGameData.ts                          (edit)
src/routes/_authenticated/bet.$marketId.tsx      (edit)
```
