## Problem

For Kalyan, Sridevi Night (and any market whose result was prematurely written by the scraper), today's `market_results` row already has `open_pana` + `close_pana` even though the actual betting cutoffs (Kalyan 15:45/17:45, Sridevi Night 19:00/20:00) are still in the future. This breaks two things:

1. **UI** shows a "DECLARED" badge and today's (wrong) numbers — users think the game is over.
2. **`place_bets` RPC** flips `_open_session_open` / `_close_session_open` to `false` the moment a pana exists for that session, so every bet attempt fails with `OPEN_SESSION_CLOSED` / `CLOSE_SESSION_CLOSED`.

The fix per the user's ask: while a session's cutoff hasn't passed, ignore today's pre-existing result, allow bets, badge OPEN, and show the previously declared result (with its date).

## Plan

### 1. `supabase/migrations/...sql` — relax `place_bets` time check

Replace the block:

```sql
IF FOUND AND _existing_result.open_pana  IS NOT NULL THEN _open_session_open  := false; END IF;
IF FOUND AND _existing_result.close_pana IS NOT NULL THEN _close_session_open := false; END IF;
```

with a time-gated version — a stale result only blocks a session *after* its cutoff has passed:

```sql
IF FOUND AND _existing_result.open_pana  IS NOT NULL AND _now_hhmm >= _market.open_time  THEN _open_session_open  := false; END IF;
IF FOUND AND _existing_result.close_pana IS NOT NULL AND _now_hhmm >= _market.close_time THEN _close_session_open := false; END IF;
```

Time remains the primary gate (the existing `_now_hhmm < open_time/close_time` checks above are untouched), so this is safe.

### 2. `src/components/ResultCard.tsx` — treat today's result as not-yet-declared while accepting bets

- Import `isAcceptingBets` from `@/lib/marketTime`.
- Tick every 15 s (same pattern as `useLiveTick`) so the badge auto-flips at cutoff.
- Compute `accepting = isAcceptingBets(market)`.
- `const effectiveDeclared = result?.status === "DECLARED" && !accepting;` and use it everywhere `declared` was used.
- Badge logic: if `accepting` → **OPEN** (green pulse), regardless of today's row. Otherwise keep the existing DECLARED / PENDING / CLOSED branches against `effectiveDeclared`.
- Result body: when `accepting`, the existing `showFallbackSlot` / `usePrev` path already kicks in (since `effectiveDeclared` is false and dashboard passes `showPreviousFallback`), so the previous declared result + date label render automatically.

### 3. No other UI changes

`dashboard.tsx` already passes `showPreviousFallback` + `previousResult` + `previousLoading` / `previousError`, so the ResultCard change alone fixes the dashboard cards. `markets.tsx` badges already use the live `isAcceptingBets(m)` selector. `bet.$marketId.tsx` already uses live session windows — once the RPC is relaxed, submission works.

## Result

- Kalyan, Sridevi Night, and any other market whose time slot is still open will:
  - Show **OPEN** badge.
  - Show **yesterday's** (or latest previous) declared result with a "Prev · DD MMM" label.
  - Accept bets through the bet page and bet slip without `*_SESSION_CLOSED` errors.
- After the real cutoff passes, the existing DECLARED / PENDING logic resumes unchanged.