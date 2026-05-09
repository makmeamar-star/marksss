
# Admin Dashboard — Activate All + Roadmap

## Current state
The admin shell and these pages already work: Dashboard, Markets, Declare Results, Result History, Automation, Scraper, Automation Runs, Automation Audit, Deposits, Withdrawals. The home page is just a static tile grid — no live data, no KPIs, and several common admin surfaces (users, bets monitor, broadcasts, reports, settings) don't exist yet.

## Phase 1 — Activate the shell into a real control center

### 1.1 Live Dashboard (`/admin`)
Replace the static tile grid with an operational overview:
- **KPI strip (today, IST):** Active users • New signups • Bets placed • Bet volume ₹ • Gross payout ₹ • House P&L ₹ • Pending deposits • Pending withdrawals.
- **Today's markets table:** market, open/close time, scraped status, declared open pana, declared close pana, automation on/off, quick "Declare" link.
- **Recent activity feed:** last 20 audit_log rows (declares, corrections, approvals, auto-declares).
- **Health tiles:** last scraper run + success rate (24h), last automation run, count of client_errors (24h).
- All data via `createServerFn` + `requireSupabaseAuth`, 30 s `useQuery` refetch + realtime invalidation on `bets`, `market_results`, `deposit_requests`, `withdrawal_requests`.

### 1.2 Users (`/admin/users`)
- Searchable, paginated table of `profiles` joined with role + last bet/deposit.
- Row actions: view profile drawer (balance, totals, KYC, recent bets/tx), grant/revoke admin role, adjust balance (admin credit/debit with reason → `wallet_transactions` + `audit_log`), suspend (set a `profiles.status` flag — needs migration).

### 1.3 Bets Monitor (`/admin/bets`)
- Live table of bets with filters: market, session, status, date range, user, min amount.
- Aggregate footer: count, total stake, exposure (potential payout) per bet_type / number — surfaces concentration risk before declaring.
- Bulk export CSV.

### 1.4 Broadcasts (`/admin/broadcasts`)
- Compose a notification → insert one `notifications` row per active user (server fn, batched).
- Audience: all users / admins only / users with balance > X / users who bet today.
- History table with delivered count + read rate.

### 1.5 Reports (`/admin/reports`)
- Date-range picker (default last 7 days IST).
- Charts: daily bet volume, daily payout, daily new users, daily deposits vs withdrawals, per-market P&L.
- "Export CSV" for each table. Use Recharts (already in shadcn stack).

### 1.6 Settings (`/admin/settings`)
- Global config: default min/max bet, scraper sources & cron interval, automation default grace minutes, welcome bonus amount, payment screenshots required toggle.
- Stored in a new `app_settings` key/value table (admin RLS).

### 1.7 Polish
- Sidebar: add Users, Bets, Broadcasts, Reports, Settings (with section dividers: Operations / Money / Growth / System).
- Fix `beforeLoad` race: gate via `_authenticated` style — wait for `supabase.auth.getUser()` then role check; show skeleton instead of redirect flash.
- Add a global `<AdminBreadcrumbs />` in the shell.
- Mobile: make tables horizontally scrollable wrappers; sticky table headers.

### 1.8 QA pass
For every admin route: load → primary action → empty state → error state → mobile (430px). Log fixes.

---

## Phase 2 — Advanced future features (roadmap)

**Risk & Liability**
- Per-market real-time exposure heatmap (which numbers, if hit, cost the house most).
- Auto-suspend a number when exposure > threshold.
- Per-user bet limits and daily loss caps.

**Fraud & Safety**
- Multi-account detection (shared device fingerprint, IP, UPI/UTR).
- Velocity rules (X deposits/withdrawals in Y minutes → flag).
- Withdrawal hold rules (first withdraw after deposit, KYC gating).
- Admin-only "shadow ban" (user can place bets but they're voided).

**KYC & Compliance**
- KYC document upload + admin review queue, status on profile.
- Audit export (CSV/PDF) for any date range, signed by admin.
- Per-state geo-block toggle.

**Payments**
- Payment-method manager (UPI VPAs, QR images, bank accounts) shown to users on deposit screen — sourced from admin.
- Auto-match UTR → deposit request (background job).
- Payout queue with batching + CSV export for bank upload.

**Result Pipeline**
- Multi-source consensus scraper (dpboss + matka results + 1 more), auto-declare only when ≥2 agree.
- Manual override with side-by-side source comparison.
- Per-market scrape cadence and selector overrides editable in UI.

**Engagement**
- In-app banners/announcements scheduler.
- Push notifications (web push) + WhatsApp/SMS provider hooks.
- Referral program admin: codes, commission %, payouts ledger.
- Promotions engine: cashback rules, deposit bonuses with wagering requirements.

**Analytics**
- Cohort retention, ARPU/ARPDAU, churn dashboard.
- Funnel: signup → first deposit → first bet → repeat.
- Anomaly alerts (bet volume spike, payout spike) via email/Telegram.

**Ops & Reliability**
- Background job runner page (cron status, last run, manual trigger).
- Edge-function & client-error log viewer with search.
- Feature flags table (toggle any feature without deploy).
- Maintenance mode banner + bet-blocking switch.

**Admin org**
- Multiple admin roles: super_admin, finance, support, content (extend `app_role` enum + per-route guards).
- Per-action 2FA prompt for sensitive ops (balance adjust, role grant, withdrawal approve > ₹X).
- Full activity audit per admin user.

---

## Technical notes
- All new server logic via `createServerFn` (`requireSupabaseAuth` + `is_admin()` check inside handler).
- New tables (`app_settings`, KYC docs, payment methods, feature flags, referrals) added via `supabase--migration` with RLS limited to admins / owner.
- Reuse existing patterns: `useQuery` + realtime channel invalidation; toast on mutation; shadcn `Table`, `Dialog`, `Sheet`, `DropdownMenu`.
- No design-token violations — all new UI uses semantic tokens from `src/styles.css`.

## Suggested order
Phase 1.1 (Live Dashboard) → 1.2 (Users) → 1.3 (Bets Monitor) → 1.7 (sidebar/polish) → 1.5 (Reports) → 1.4 (Broadcasts) → 1.6 (Settings) → 1.8 (QA). Phase 2 items picked per business priority.

Confirm and I'll start with Phase 1.1.
