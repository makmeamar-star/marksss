## Scope this turn

Four modules, in this order:
1. Turn 2 of admin migration — server fns + settlement engine
2. Module 1 — public `/results` (Realtime)
3. Module 2 — `/markets/$marketId/bet` (real DB-backed betting)
4. Module 3 — `/dashboard/bets`

Explicitly **deferred**: Modules 4 (Wallet), 5 (Notifications), 6 (Admin Finance), 7 standalone (settlement is folded into #1), 8 (Charts), the global nav/skeleton/toast/offline/error-boundary pass. We'll pick those up in a follow-up turn.

I'll also do the prerequisites those modules can't live without (auth + profiles + first-signup-admin trigger), and quietly fix the SSR hydration mismatch in `CountdownTimer`.

---

## Step 0 — Prerequisites (must land first)

**a) Auth pages must actually use Supabase.** Today `authStore.ts` is a Zustand stub that mints a fake user; `login.tsx` / `register.tsx` don't call Supabase. Without real auth there are no JWTs and every admin / user-scoped endpoint 401s.

- Replace `authStore.ts` with a thin wrapper that subscribes to `supabase.auth.onAuthStateChange` (set listener BEFORE `getSession`, per the Lovable rule).
- Rewrite `/login` and `/register` to call `supabase.auth.signInWithPassword` / `signUp` (with `emailRedirectTo: window.location.origin`).
- Auto-confirm email on for dev (no inbox needed).
- `_authenticated.tsx` route guard reads from the new auth state.

**b) Profiles + balance.** Wallet balance currently lives in client Zustand. To do real betting we need it server-side.

Migration:
- `public.profiles (user_id PK → auth.users, username, email, balance numeric default 0, total_deposit, total_withdraw, total_bet, total_win, kyc_status, created_at)` — RLS: user reads/updates own; admin reads all.
- Trigger `on_auth_user_created` → inserts profile row + seeds `balance = 1000` (dev convenience, removable later).
- **First-signup-admin trigger**: same trigger checks `if (select count(*) from public.user_roles) = 0` then inserts `('admin', NEW.id)`. Subsequent signups get role `'user'`.

**c) Hydration fix.** `CountdownTimer` calls `msUntil()` during render → SSR computes a different time than first client paint. Render `--:--:--` until `useEffect` ticks once. Same fix for the `LiveClock` admin component.

---

## Step 1 — Admin migration Turn 2 (server fns + settlement)

Files (all `.functions.ts`, kept thin per import-protection rules; helpers in `.server.ts`):

- `src/lib/admin.server.ts` — `requireAdmin(supabase, userId)` helper that calls `has_role` via `supabase.rpc('has_role', { _user_id, _role: 'admin' })` (we revoked direct EXECUTE so this needs to go through a tiny SQL wrapper — adding `public.is_admin()` returning `has_role(auth.uid(),'admin')` granted to authenticated). Throws 403 otherwise.
- `src/lib/admin.functions.ts` — server fns:
  - `validatePana(pana)` — pure, uses `settlement.server.ts`.
  - `pendingToday()` — joins `markets` with today's `market_results`; returns rows missing open/close pana with bet counts/amounts (admin-only).
  - `declaredToday()` — today's `market_results` joined to `markets`; computes `correctionWindowOpen` from `declared_at`.
  - `getMarketSessionInfo(marketId, session, date)`.
  - `impactPreview(input)` — fetches pending bets for the session from DB, runs `settleBets` server-side, returns winners/losers/payout/warning. **No client bet snapshot needed anymore.**
  - `declareResult(input)` — admin-only, transactional via a single SQL function `public.declare_result(...)` that:
    1. Validates pana, market not suspended, not already declared for that session.
    2. Inserts/updates `market_results` row (sets pana/digit, sets `jodi` if both sessions filled, status='DECLARED', declared_by=auth.uid()).
    3. Calls settlement: server fn fetches pending bets, settles them, then inside same SQL transaction updates `bets.status`/`win_amount`/`settled_at`, inserts `wallet_transactions` (BET_WIN) for each winner, increments `profiles.balance` and `profiles.total_win`.
    4. Inserts `audit_log` row (`action='DECLARE'`, market/session/pana, metadata: { winners, payout }).
  - `correctResult(input)` — within 10-min window: reverses prior settlement (creates compensating `wallet_transactions` rows, marks bets back to PENDING then re-settles), writes audit row with `previous_pana`. Implemented as `public.correct_result(...)` SQL function called from server fn for transactional safety.
- **Rewrite** `src/lib/adminApi.ts` to be a thin wrapper that calls these server fns via `useServerFn` / direct invocation. Same exported function shapes so `/admin/results/declare` keeps working without component changes.
- Delete now-unused Zustand pieces of `auditStore`/`realtimeStore` writes that the server now owns; keep client realtime subscription to `audit_log` and `market_results` for the live activity feed.

Realtime: enable publication for `markets`, `market_results`, `bets`, `wallet_transactions`, `audit_log` (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`, `REPLICA IDENTITY FULL`).

---

## Step 2 — Module 1: `/results` (DB + Realtime)

Today's `/results` reads from `marketStore` Zustand. Rebuild on `markets` + `market_results` queries.

New components:
- `LiveResultsBanner` — gradient sticky banner, pulsing LIVE badge, today's date (deterministic SSR-safe), `LiveClock`.
- `ResultsTickerLive` — replaces existing `ResultsTicker`; pulls today's declared results from `market_results`, re-renders on Realtime INSERT/UPDATE.
- `ResultsFilterBar` — pill toggle (All / Open Now / Declared / Upcoming), view-mode toggle (grid/list/compact) persisted to `localStorage`, sort toggle, prev/today date stepper (next-day disabled), auto-refresh switch (default ON; ON = subscribed to Realtime, OFF = unsubscribe and show "Refresh now" button).
- `MarketResultCard` (rebuild) — implements all 5 states (UPCOMING / OPEN / CLOSED-AWAITING / PARTIAL-DECLARED / FULL-DECLARED) using:
  - `derivedStatus(market, todayResult, now)` helper that returns the state.
  - Pana boxes + DigitCircle + Jodi card (reuse existing admin DigitCircle).
  - `Reveal animation`: when Realtime delivers an UPDATE that fills a pana, run a slot-machine animation on the affected pana (Framer Motion), spring digit, flip jodi, 20-particle confetti from card center, "NEW" corner badge auto-removing after 30s.
  - For logged-in users: query their `bets` for that `market_id`+`session_date`+session in the same `useQuery`; if any won → "You won ₹X" slide-up overlay with count-up.
- `ResultsListView` — sortable table, sticky first column on mobile, expand row to inline card.
- `ResultsCompactView` — single-line per market.
- `HistoricalResultsTabs` — Today / Yesterday / Last 7 / Monthly / Search:
  - Tabs use server fns `getResultsForDate(date)` and `searchResults({jodi?, pana?, digit?, dateFrom?, dateTo?})`.
  - Monthly = calendar grid querying month range, click cell to expand.
- `ConnectionStatusDot` — bottom-right; reflects Supabase channel state (SUBSCRIBED → green, CHANNEL_ERROR/TIMED_OUT → yellow/red).

Sound notification + dynamic `document.title` update on new declaration (gated on user-gesture for autoplay policy).

---

## Step 3 — Module 2: `/markets/$marketId/bet`

Replace mock `BetSlip.tsx` and Zustand `betStore` writes with real DB-backed flow.

Server fns (`src/lib/bets.functions.ts`):
- `getMarketBetContext(marketId)` — returns market row + today's result row (to know which sessions are still open) + user's current `profiles.balance`.
- `placeBets(input: { marketId, sessionDate, items: BetItem[] })` — auth-required; runs SQL function `public.place_bets(...)` that:
  1. Validates market exists, not suspended.
  2. Validates each session is still open (compares `now()` IST to market `close_time`/`open_time`; if past → throws `MARKET_CLOSED`).
  3. Validates pana for SP/DP/TP/Sangam against `is_valid_pana` (port to SQL via lookup table seeded once).
  4. Sums total amount, locks profile row, checks `balance >= total`.
  5. Inserts N `bets` rows (`status=PENDING`, `payout` = market payout for type).
  6. Inserts a `wallet_transactions` row per bet (type=`BET_PLACED`, debit) and decrements `profiles.balance`/`profiles.total_bet`.
  7. Returns `{ placedCount, totalAmount, newBalance, bets: [{id,...}] }`.

Note: SQL inserts happen as a SECURITY DEFINER function so the user can write to `wallet_transactions` (which is admin-write per RLS). The function checks `auth.uid()` matches and enforces business rules itself.

Page `src/routes/_authenticated/markets/$marketId/bet.tsx`:
- Header: market name, live status, session pill tabs (OPEN/CLOSE/BOTH), live close countdown, balance chip.
- Bet type tab bar with payout chips (SINGLE / JODI / PANA / HALF SANGAM / FULL SANGAM).
- Tab panels:
  - `SingleDigitPanel` — open/close sub-tab + 0-9 grid (multi-select).
  - `JodiPanel` — first-digit filter + 10×10 grid + search jump.
  - `PanaPanel` — open/close, SP/DP/TP, digit filter; pulls panas from `panaChart.ts`.
  - `HalfSangamPanel` — type toggle + two-step picker.
  - `FullSangamPanel` — open pana + close pana picker, jodi preview, high-risk warning.
- `BetSlipDrawer` — sticky right (desktop) / bottom drawer (mobile). Inline-editable amounts, "apply same to all" toggle, totals, balance projection, insufficient-balance warning + Add Funds link (links to existing `/wallet` for now).
- Place Bets flow → confirmation modal → server fn → success state with toast and slip clear → on `MARKET_CLOSED` race: red banner + clear slip with explanation.
- Live close-time enforcement: when countdown hits zero, disable submit, show banner.

---

## Step 4 — Module 3: `/dashboard/bets`

Server fn `getMyBets({ filters, page })` — reads from `bets` filtered by `auth.uid()` (RLS already restricts).

Page `src/routes/_authenticated/dashboard/bets.tsx`:
- 5 stat cards across the top: total bets, total spent, total won, pending, net P&L (computed in a single aggregate server fn `getMyBetStats()`).
- Filter bar: date range, market, session, bet type, status; active filters as removable chips.
- Desktop table (sortable) + mobile card view; status pills; expandable row showing settled timestamp + matching `market_results` row + transaction reference.
- Pagination 25/page.
- Pending Bets highlighted panel with countdowns to result time.
- CSV export only (PDF deferred).

---

## Step 5 — Cleanup of old client-only stores

After endpoints are wired:
- `marketStore`, `betStore`, `walletStore` reduced to thin selectors over server data (or removed where React Query replaces them). Existing screens that still reference them (`/wallet`, `/profile`, admin pages) keep working because adminApi.ts retains the same export shape.
- `WinCelebration` triggered by Realtime UPDATE on `bets` where `status='WON'` and `user_id = me`.

---

## Out of scope this turn (will plan next)

- Module 4 Wallet (deposit_requests, withdrawal_requests tables, screenshot storage, KYC flow, bank/UPI config)
- Module 5 Notifications page + bell + win overlay polish
- Module 6 Admin Finance tabs
- Module 8 Charts (jodi grid, heatmap, pana chart, hot/cold)
- Global nav redesign, mobile bottom tab bar, balance chip animation, skeletons, offline banner, error boundary
- Sound files / push notifications

---

## Technical specifics

- **Stack**: TanStack Start on Cloudflare Workers; all server logic via `createServerFn` + Supabase. No Express, no Socket.io.
- **Realtime**: `supabase.channel(...).on('postgres_changes', ...)` with publication enabled for the 5 tables listed.
- **Settlement transactionality**: business logic lives in `SECURITY DEFINER` SQL functions (`declare_result`, `correct_result`, `place_bets`) so the whole money-moving path is one DB transaction with row locks. Server fns are thin RPC wrappers that call these.
- **Auth guard**: every server fn uses `requireSupabaseAuth` middleware; admin fns additionally call `requireAdmin(supabase, userId)`.
- **RLS**: existing policies are unchanged. The SECURITY DEFINER functions enforce business rules (own user only, admin only) inside their bodies because they run elevated.
- **Pana validation in SQL**: seed a small `pana_chart(pana text PK, digit smallint, type text)` table from `panaChart.ts` at migration time; SQL functions validate against that. Keeps server fns and SQL fns aligned.
- **Type safety**: `src/integrations/supabase/types.ts` regenerates after migration; server fns import `Database['public']['Tables']` types.
- **Realtime auto-refresh OFF**: client unsubscribes channel; `useQuery` runs on mount only; "Refresh now" calls `refetch()`.

## Risks / things you should know

- This refactor touches roughly 30+ files. Some screens (admin `/admin/results/declare`, `/wallet`, `/profile`) will briefly look unchanged but their data source flips under the hood.
- After this turn, `betStore.bets` and `marketStore.results` Zustand persistence will go stale; I'll add a one-time migration to drop those localStorage keys so users don't see ghost data.
- Auto-promote-first-signup is a dev convenience. Before going live you must remove that branch from the trigger and assign admin manually.
- Settlement happens synchronously inside `declareResult`. For 10k+ pending bets this could be slow; if that becomes real, we move it to a background edge function. Out of scope this turn.

If this plan looks right, hit Implement and I'll execute it in the order above.