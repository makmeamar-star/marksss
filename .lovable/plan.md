## Goals

1. Dashboard "Active Markets" should show only markets currently accepting bets in either OPEN or CLOSE session, refreshed live.
2. Kalyan (and every other market) must accept CLOSE bets during its CLOSE window (e.g. 15:45–17:45 for Kalyan), not just before its OPEN cutoff.
3. Across the dashboard and `/markets`, bet-accepting markets are sorted to the top.

## Root cause for #2

`market.isOpen` is computed once inside the `useMarkets` query mapper (`src/hooks/useGameData.ts` line 24) using `computeIsOpen`. That value is cached by React Query and never recomputes as the clock moves, so once Kalyan crosses its OPEN cutoff at 15:45 the cached `isOpen` and any UI that depends on it goes stale, and pages that gate "Bet Now" / session tabs on `market.isOpen` instead of a live `isCloseSessionOpen(market)` check treat Kalyan as closed for the rest of its CLOSE window.

The DB `place_bets` RPC already allows CLOSE bets while `now() AT TIME ZONE 'Asia/Kolkata' < market.close_time`, so this is a pure client-side staleness bug.

## Plan

### 1. `src/lib/marketTime.ts`
- Add a single helper `isAcceptingBets(m)` = `isOpenSessionOpen(m) || isCloseSessionOpen(m)`.
- Keep `computeIsOpen` returning `isCloseSessionOpen` (current behavior) — but no UI should rely on the cached value for hard gates anymore.

### 2. `src/hooks/useGameData.ts`
- Stop baking time-dependent flags into the cached Market. Remove `isOpen` from the mapped object (or compute it but mark it advisory only) and update `Market.isOpen` in `src/lib/types.ts` to `isOpen?: boolean` so existing reads still compile.
- Reduce the cache window slightly (e.g. `staleTime: 30s`) so the badge eventually self-heals on refetch; live correctness comes from helpers below.

### 3. New `useLiveAcceptingMarkets` hook (in `src/hooks/useGameData.ts`)
- Reads `useMarkets()`, ticks every 15 seconds, returns `{ accepting, others }` where `accepting` is the subset where `isAcceptingBets(m)` is true, sorted by closest upcoming cutoff (`min(openTime if openOpen, closeTime if closeOpen)` ascending). `others` keeps original order.

### 4. `src/routes/_authenticated/dashboard.tsx`
- Replace the "Active Markets" section: title becomes "Markets accepting bets now", grid shows `accepting` (cap at 6). If `accepting.length === 0`, render an empty state ("No markets are accepting bets right now — check back soon") with a link to `/markets`.
- Each card keeps the existing `ResultCard` + adds the "Bet Now" CTA (mirroring the home page) so users can act immediately.

### 5. `src/routes/markets.tsx`
- Add the same per-second/15s tick.
- After the existing filter pipeline, sort the result so `isAcceptingBets(m)` markets come first (within that group sort by closest upcoming cutoff), then non-accepting markets in their current order.
- Replace the existing `m.isOpen ? "Open" : "Closed"` badge with a live check using `isOpenSessionOpen`/`isCloseSessionOpen` so Kalyan shows "Open" through 17:45.
- "Bet Now" button stays enabled whenever `isAcceptingBets(m)` is true (currently it always links through — keep it visible but gray out when not accepting).

### 6. `src/routes/_authenticated/bet.$marketId.tsx` (Kalyan fix verification)
- The page already uses live `isOpenSessionOpen` / `isCloseSessionOpen` and auto-switches OPEN→CLOSE when OPEN closes, so functionally it should already accept Kalyan CLOSE bets between 15:45 and 17:45. Audit:
  - Confirm the auto-switch effect runs before the user clicks (it does — runs on mount tick).
  - Make sure the "Closed for today" banner only renders when **both** windows are closed (already correct).
- No server-side change needed.

### 7. Verification
- During Kalyan CLOSE window (15:45–17:45 IST): bet page lands on CLOSE tab, OPEN tab locked, countdown targets 17:45, placing a CLOSE single succeeds.
- Dashboard "Markets accepting bets now" lists Kalyan with a Bet Now button during that window and removes it after 17:45.
- `/markets` lists Kalyan at the top with green "Open" badge during the CLOSE window, drops to the closed group after 17:45.
- Markets with both sessions still open (e.g. before openTime) appear at the very top, sorted by which closes soonest.

## Out of scope
- No DB/RPC changes.
- No changes to the bet slip submission logic (already handled in the prior fix).
- No new markets list page; just sort/badge tweaks.
