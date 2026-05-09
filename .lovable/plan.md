## Quick answer on automation

**Automated result declaration is NOT active.** Today every result is declared by hand from `/admin/results/declare`. There is no cron job, no scheduled edge function, and no scheduler in the database. Section 5 below proposes how to add it if you want it.

---

## What's already done

- Auth, profiles, first-signup-admin, RLS — ✅
- `/results` public page with Realtime — ✅
- `/markets/$id/bet` real DB-backed betting — ✅
- `/dashboard/bets` (My Bets) — ✅
- Admin: declare result, correct result (10-min window), settlement engine — ✅

## What's still mock / missing

| Area | Today | Gap |
|---|---|---|
| Wallet `/wallet` | reads local Zustand | needs real deposits/withdrawals |
| Admin finance | doesn't exist | needs deposit/withdrawal approval queues |
| Notifications | local store, fake items | needs DB table + bell + Realtime |
| Charts `/charts` | client mock data | needs queries over `market_results` history |
| Profile | partially mock | balance + stats from `profiles` already exist; KYC + bank details missing |
| Global UX | basic | offline banner, win celebration on Realtime, mobile bottom-nav, error boundary |
| Auto-declare results | none | optional scheduler (Section 5) |

---

## 1 — Wallet module (real deposits & withdrawals)

**DB:** `deposit_requests` and `withdrawal_requests` already exist with RLS. Add storage bucket `payment-screenshots` (private, user-folder policy).

**User-facing `/wallet`:**
- Header: live balance from `profiles`, totals (deposit/withdraw/bet/win) — already in DB.
- Tabs: **Deposit · Withdraw · History**.
- **Deposit**: amount + method (UPI / Bank) + UTR + screenshot upload → `deposit_requests` row (status `PENDING`). Show pending requests with status pill.
- **Withdraw**: amount (≤ balance) + method + bank/UPI details (JSON) → `withdrawal_requests` row. Block if pending request exists.
- **History**: paginated `wallet_transactions` (BET_PLACED, BET_WIN, DEPOSIT, WITHDRAWAL, REVERSAL).
- All writes via server fns with `requireSupabaseAuth`; RLS already restricts reads to own rows.

**Server fns** (`src/lib/wallet.functions.ts`): `submitDepositRequest`, `submitWithdrawalRequest`, `myWalletHistory(filters,page)`, `myPendingRequests`.

**Cleanup:** remove `walletStore` writes; convert to thin React Query selectors.

## 2 — Admin Finance (`/admin/deposits`, `/admin/withdrawals`)

Two new admin pages + sidebar links (already in admin nav).

- Queue table: pending requests with user email, amount, method, UTR, screenshot preview, age.
- **Approve deposit** → SECURITY DEFINER SQL fn `approve_deposit(_req_id, _note)`: marks request `APPROVED`, inserts `wallet_transactions` (DEPOSIT credit), bumps `profiles.balance` & `total_deposit`, audit row.
- **Reject deposit** → status `REJECTED` + reason; no money moves.
- **Approve withdrawal** → debits balance, marks request `APPROVED`. Insufficient-balance guard.
- **Reject withdrawal** → reason required.
- Filters: status, date range, amount range, method.
- Realtime: subscribe to inserts on both tables → toast "New deposit request from X".

## 3 — Notifications

**DB migration:**
- `notifications (id, user_id, type, title, body, link, read_at, created_at)` — RLS: user reads/updates own.
- Triggers that auto-insert on: bet WON (from `declare_result`), deposit/withdrawal status change, admin broadcast.
- Add `notifications` to `supabase_realtime` publication.

**UI:**
- Bell in header with unread count, popover preview.
- `/notifications` page: list, filter (all/unread/by type), mark read / mark all read, click → navigates to `link`.
- Win celebration overlay: subscribe to `bets` UPDATE where `user_id=me, status=WON` → fire `WinCelebration` (component already exists).

## 4 — Charts (`/charts`)

Reads from `market_results` history.

- **Per-market jodi grid**: 10×10 cell heatmap of how often each jodi has appeared in last N days.
- **Pana frequency** (SP/DP/TP separately): bar chart sorted by hit count.
- **Hot/cold digits**: 0–9 with last-seen date and frequency.
- **Date-range picker** (7/30/90/365 days, custom).
- **Export PNG/CSV** per chart.

Server fns: `getJodiFrequency(marketId, range)`, `getPanaFrequency(marketId, type, range)`, `getDigitStats(marketId, range)`. All RLS-public reads.

## 5 — Automated result declaration (OPTIONAL)

Right now nothing declares results automatically. Two ways to add it:

**Option A — Manual only (current).** Admin sits at `/admin/results/declare` at result time and types the pana. Simple, what you have.

**Option B — Scheduled auto-declare from a feed.**
- New table `result_feeds (market_id, source_url, parser, enabled)`.
- Edge function `auto-declare-results` that:
  1. Runs every minute via `pg_cron`.
  2. For each enabled feed whose market is past `result_time` and not yet declared, fetches the source and parses today's pana.
  3. Calls `declare_result(...)` (existing SECURITY DEFINER fn) with a system actor.
  4. Logs to `audit_log` with `actor_id = NULL, action='AUTO_DECLARE'`.
- Admin UI `/admin/results/automation`: toggle per market, configure source URL, view last run, "pause auto-declare" master switch.
- Failures (feed unreachable, parse fail, ambiguous result) leave it pending and notify admins via the bell.

**Recommendation:** ship Option A polish first (it's already live), then add Option B in a follow-up turn once you've decided on a real result feed source. Pana feeds are usually scraped — needs a URL you trust.

## 6 — Polish pass

- Global error boundary on root route (currently default).
- Offline banner driven by `navigator.onLine` + Supabase channel state.
- Mobile bottom nav (Home / Markets / Bets / Wallet / Profile).
- Skeletons replacing spinner blanks on all list views.
- `WinCelebration` triggered from Realtime as described in §3.
- Quietly fix the `CountdownTimer` SSR hydration mismatch (render `--:--:--` until first effect tick).

---

## Build order I'd suggest

1. **Wallet + Admin Finance** (real money flows — biggest user-visible gap).
2. **Notifications + WinCelebration Realtime** (closes the loop on bet → win UX).
3. **Charts** (pure read-side, low risk).
4. **Polish pass** (offline, mobile nav, skeletons, hydration fix).
5. **Automation (Option B)** — only if you confirm a result-feed source.

## Technical notes

- Stack stays TanStack Start + Supabase. No new services.
- All money-moving paths are SECURITY DEFINER SQL functions inside one DB transaction (same pattern as `declare_result` / `place_bets`).
- Storage bucket for screenshots is private; users upload to `userId/<uuid>.jpg`, admins read via signed URLs.
- Notifications use Realtime publication + a single `INSERT` policy from triggers (no client writes).
- Charts queries hit `market_results` directly (already public-readable) — no new RLS.

## Risks

- Auto-declare (§5) depends on a scrape-able source you control — fragile by nature. Recommend keeping manual declare as a fallback even after enabling.
- Admin approving large withdrawals while balance is being mutated by bets — handled by row-level lock inside the SQL fn (same as `place_bets`).
- Deposit screenshot storage cost grows fast; add a 90-day retention cleanup job later.
