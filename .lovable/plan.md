## End-to-end audit of SattaKing Pro

I tested the full app via the browser, walked the codebase, and inspected the database. Here is what I found, grouped by severity.

---

### Bugs (must fix)

1. **Admin Dashboard crashes** — `/admin` throws `TypeError: Cannot read properties of undefined (reading 'scrapeOk')` and renders blank KPIs / "No active markets" even though 8 markets exist. The page error was logged to `client_errors`. Source: `src/routes/admin/index.tsx` references `data?.health.scrapeOk` (and similar) without guarding `data.health`. Server function returns shape inconsistently / errors silently.

2. **Login does not redirect** — clicking "Demo Admin" shows a "Welcome, admin!" toast but the user stays on `/login`; they must navigate manually. Login flow's `navigate({ to: search.redirect })` is not firing.

3. **Notifications page is disconnected from the database** — `/notifications` reads/writes a local Zustand store (`notificationStore.ts`, persisted to localStorage). The real `notifications` table — populated by DB triggers for bet wins/losses, deposit/withdraw approvals, admin actions — is **never read or shown to users**. The bell icon and inbox are effectively dead.

4. **Hero / hardcoded fake stats on homepage** — "48,219 Active Players" and "1,847 Today's Winners" are string literals in `src/routes/index.tsx`. Misleading on a real product.

5. **Login page misleading copy** — header says "Use any username — this is a mock login" but it is real Supabase auth. Confusing for real users.

6. **Auth store hardcodes `status: "ACTIVE"` and a synthetic `referralCode`** — `src/stores/authStore.ts` ignores the actual `profiles.status` column (so a SUSPENDED user still sees "ACTIVE" in their profile) and fabricates a referral code per session.

### Incomplete features (placeholders / mock-only)

7. **Result History page is a stub** — `src/routes/admin/results.history.tsx` literally says "Historical results browser arrives in Phase 4.5."

8. **Profile page is mostly mock** — phone "Save changes" only shows a toast (no DB write); 2FA toggle is fake; KYC upload buttons are fake; "Change password" sends a fake toast (no `resetPasswordForEmail`); "Delete account" is disabled with an error toast.

9. **No `/reset-password` page** — the login page links to "Forgot password?" but there is no recovery route, so even if the email were sent the user cannot complete the reset.

10. **Referral system not implemented** — registration captures a referral code, profile shows one, but nothing is stored, validated, credited, or paid out. No `referrals` table, no bonus logic.

11. **KYC not implemented** — `profiles.kyc_status` exists and is shown, but there is no upload flow, no document storage, no admin KYC review queue, and the wallet does not actually gate withdrawals on KYC.

12. **Charts page – Open/Close + Jodi tabs are partial** — only the Pana tab is meaningful; the others render basic tables without filtering UX expected from a Matka chart.

### Missing admin/operational features (planned but never built)

13. **Broadcasts** — sidebar plan called for an admin broadcast composer that inserts into the `notifications` table for user segments. Not built.

14. **Reports / Analytics** — no `/admin/reports` (volume, payouts, growth charts). The admin nav lists no analytics page.

15. **Settings** — no `/admin/settings` (global limits, scraper interval, bonus toggles, app_settings table).

16. **Risk / exposure dashboard** — Bets Monitor shows totals but there is no per-number / per-market exposure view to spot a high-risk pana before declaring.

17. **Edge functions are nearly empty** — only `ensure-demo-admin`. Cron-like tasks (`run_due_auto_declarations`) are SQL functions that need a scheduler or `/api/public/*` endpoint to be triggered.

### Smaller polish items

18. SiteHeader bell icon does not show real unread count (because of #3).
19. Wallet page deposit screenshot upload exists but I should confirm it actually uploads to the `payment-screenshots` bucket end-to-end.
20. `src/routes/api/public/hooks/` — verify cron endpoints are wired (auto-declare, scrape, backfill) and have signed access if invoked externally.

---

### Proposed remediation order

**Phase A — Hot fixes (ship today):**
- Fix admin dashboard crash (guard `data?.health?.scrapeOk` etc., make server fn always return a complete shape).
- Fix login redirect after demo/normal login.
- Replace hardcoded homepage stats with real counts (or remove them).
- Update login copy ("Sign in to your account" instead of "mock login").
- Read `profiles.status` into auth store.

**Phase B — Notifications & profile (1 PR):**
- Replace `notificationStore` with a Supabase-backed query + realtime subscription on `notifications` table; mark-read writes to DB; bell icon shows real unread count.
- Make profile phone save persist; remove fake 2FA / KYC / change-password buttons OR wire them properly (see Phase C).

**Phase C — Auth completeness:**
- Add `/reset-password` route + Forgot Password flow with `resetPasswordForEmail`.
- Optional Google OAuth.

**Phase D — Build out missing admin pages:**
- Result History (paginated `market_results` browser with filters + CSV export, mirroring Bets Monitor pattern).
- Broadcasts composer.
- Reports (Recharts on bets/wallet_transactions, date range).
- Settings (`app_settings` table + CRUD).
- Per-number exposure view in Bets Monitor.

**Phase E — Real KYC & Referrals:**
- KYC: upload to storage, admin review queue, gate withdrawals.
- Referrals: `referrals` table, credit on first deposit, expose stats on profile.

I will not start any of this until you pick the slice you want first. My recommendation is to do **Phase A** (hot fixes only) immediately because the admin dashboard is currently crashing for every admin.
