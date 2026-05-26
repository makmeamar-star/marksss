## Problem

Database `place_bets` RPC already enforces the correct rules:
- OPEN-session bets must arrive before `market.open_time` (IST)
- CLOSE-session bets must arrive before `market.close_time` (IST)
- Once a result for the session is declared, that side closes immediately

But the **UI doesn't enforce the same windows**, so users can sit on the bet page after the OPEN cutoff has passed, build a slip, hit "Place", and get a generic `OPEN_SESSION_CLOSED` error — which feels like a broken timer. Specifically:

1. `src/routes/_authenticated/bet.$marketId.tsx` always shows a countdown to `closeTime` and lets users keep the OPEN tab selected past `openTime`.
2. The Jodi page (`jodi.$marketId.tsx`) places all bets as `session: "OPEN"` and counts down to `closeTime`, so after `openTime` every Jodi placement fails server-side.
3. `src/lib/marketTime.ts` `computeIsOpen` reports a market as "Closed" before `openTime`, so the markets list hides perfectly bettable OPEN windows.
4. Once `closeTime` passes, the page still accepts new slip entries instead of locking betting outright.

## Fix (frontend / presentation only)

### 1. `src/lib/marketTime.ts` — add session-aware helpers

Keep `computeIsOpen` for general "market currently running" semantics, but extend it so the markets list considers a market open whenever **either** session is still bettable. Add:

- `getNowHHMMIST()` — share the IST `HH:MM` string already computed in `nowIST`.
- `isOpenSessionOpen(market)` → `status==='ACTIVE' && today is in days && hhmm < openTime`.
- `isCloseSessionOpen(market)` → `status==='ACTIVE' && today is in days && hhmm < closeTime`.
- Update `computeIsOpen` to return `isCloseSessionOpen(market)` (i.e. bettable today). This unblocks markets in the pre-open window and keeps them visible until close.

### 2. `src/routes/_authenticated/bet.$marketId.tsx`

- Tick a 1-second clock and recompute `openOpen` / `closeOpen` each tick.
- Auto-switch session: if user is on OPEN and `openOpen` becomes false, flip to CLOSE; if both are false, leave selection but disable inputs.
- Disable the OPEN tab button (with a "Closed" badge) once `openOpen` is false; same for CLOSE.
- Replace the single `CountdownTimer targetTime={closeTime}` with a session-aware timer that targets `openTime` when OPEN is selected and `closeTime` when CLOSE is selected. Label it "Open closes in" / "Close closes in".
- In `add()`, short-circuit with a toast `"OPEN session closed"` / `"CLOSE session closed"` when the relevant window has passed (covers SINGLE/PANA/SANGAM tabs that use the current session).
- When both sessions are closed, show a "Betting closed for today" banner over the tabs and disable the "Add to slip" buttons in Sangam sections.

### 3. `src/routes/_authenticated/jodi.$marketId.tsx`

Jodi is a single-result bet that the existing RPC validates against `_close_session_open` for the CLOSE jodi flow, but this page submits with `session: "OPEN"`. Two corrections:

- Change `session: "OPEN"` → `session: "CLOSE"` for JODI bets (Jodi resolves with the close result; `close_time` is the correct cutoff and matches the existing countdown).
- Disable the "Add all to slip" button and show a "Betting closed" notice once `hhmm >= closeTime`.

### 4. `src/routes/markets.tsx`

No code change needed beyond #1 — once `computeIsOpen` is session-aware, the "Open / Closed" pill and the `status==='open'` filter automatically reflect pre-open windows correctly.

### Out of scope

- Server logic (`place_bets`, `quick_rounds`, admin declare) is already correct and stays untouched.
- Starline/Quick play already drive timing off `opens_at` / `closes_at` per round — no changes.
- Admin declare window logic, scrapers, and result correction flows are unchanged.

## Files touched

- `src/lib/marketTime.ts` — add helpers, update `computeIsOpen`
- `src/routes/_authenticated/bet.$marketId.tsx` — session-aware UI, dynamic countdown, guards
- `src/routes/_authenticated/jodi.$marketId.tsx` — submit as CLOSE, lock UI after close_time

## Verification

- Pick a market whose `open_time` is in the past but `close_time` is in the future: OPEN tab disabled, CLOSE tab live, countdown targets close_time, placing a CLOSE bet succeeds.
- Pick a market with `open_time` in the future: both tabs enabled, OPEN tab shows countdown to open_time, placing an OPEN bet succeeds.
- After `close_time`: both tabs disabled, banner shown, server is never called.
- Jodi page after `close_time`: Add button disabled, no failing RPC calls.
