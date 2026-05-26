# End-to-End Test Plan: Admin Dashboard + User Experience

I'll drive the live preview as both a regular user and an admin, exercise the full money flow, and capture any 403s, broken UI, or logic bugs. No code changes happen during testing — anything I find gets reported back with a separate fix plan.

## Scope

**User-side flows**
1. Signup / login (existing demo or new account)
2. Wallet — view balance, transaction history
3. Deposit request — pick channel, submit UTR + screenshot, see PENDING state
4. Place a bet (Jodi market + a Pana market)
5. Quick game round (place + observe settlement)
6. Withdrawal request — submit, see PENDING
7. Notifications, KYC submission, promo code redemption, referrals page
8. Jodi page — verify the 8 markets + "Yesterday's Jodi" section render with live data

**Admin-side flows** (all the routes that were 403'ing previously)
1. `/admin` dashboard loads, no 403 during SSR or client nav
2. Declare result — pick a market/session, set Pana, confirm Jodi auto-computes, see bets settle
3. Automation panel — toggle open/close automation, change mode, save
4. Payment channels — create/edit/disable a channel
5. Deposit approvals — approve + reject a pending request, balance updates on user side
6. Withdrawal approvals — approve + reject, balance + ledger correct
7. Customer service / support views — open user detail, view bets/KYC/notes
8. KYC review queue — approve/reject submission
9. Promo codes — create/edit, view redemptions
10. Audit log, system alerts, scrape log visible

## Method

For each flow I'll:
1. Navigate via the browser tool (real preview, real DB).
2. Capture a screenshot at the key state.
3. Check console + network for 4xx/5xx, hydration mismatches, RLS errors.
4. Cross-check DB rows via `supabase--read_query` where balance/ledger correctness matters.
5. Check `stack_modern--server-function-logs` and `supabase--analytics_query` if a server fn fails.

## Destructive-action safety

- I'll prefer the logged-in preview user for user-side actions.
- For admin approvals I'll act on requests I just created myself in the same session (so no real user money is moved).
- I will NOT delete users, mass-update balances, or touch unrelated production rows.
- I'll explicitly call out anything I skip for safety.

## Known issues already visible (will verify, not fix in this pass)

- Runtime: `Unauthorized: No authorization header provided` — protected serverFn fired before session hydrated. Will confirm which route triggers it.
- Runtime: SSR hydration mismatch on `HomePage` (date/time text rendered server-side differs from client IST). Will pinpoint the node.

## Deliverable

A single report grouped by area:
- ✅ Works
- ⚠️ Works but rough (UX, copy, slow)
- ❌ Broken (with exact route, request, error, and suspected root cause)

After you review the report, I'll write a focused fix plan for the ❌ items.

## Need from you before I start

1. **Admin credentials** to use in the preview (email + password), or confirmation that the currently logged-in preview session is already admin.
2. **A test user account** (or permission to sign up a fresh one like `qa+<timestamp>@test.local`) for the user-side flows.
3. Confirmation it's OK to create real PENDING deposit/withdrawal rows in the DB during the test (they'll be resolved by me in the same run).
