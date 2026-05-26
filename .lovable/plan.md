## Goal

1. **Add a hard-override** for declared results that admins can use anytime (not just within the 10-minute correction window), with confirmation + audit trail.
2. **Run an end-to-end test pass** against the live preview using a fresh test account: signup → linked accounts → deposit → bet → admin declare → settlement → withdrawal → admin actions.

---

## Part 1 — Manual Result Override (build)

### Backend

**New migration: `system_admin_override_result` DB function.**
Same shape as the existing `correct_result` (admin gate, reason required, reverses settled bets, re-settles with new pana, writes `wallet_transactions` of type `CORRECTION_REVERSAL`), but:

- No 10-minute window check.
- Stricter inputs: requires `reason` length ≥ 20 chars + a confirmation token `confirm = 'I_UNDERSTAND_THIS_RESETTLES'` so it can't be triggered accidentally by the regular correction code path.
- Tags audit metadata with `override = true`.
- Inserts a `system_alerts` row (severity `warning`) so it's visible on the admin monitoring page.

Audit row written to `audit_log`:
```
action          = 'ADMIN_HARD_OVERRIDE'
previous_pana   = <old>
pana            = <new>
reason          = <admin's reason>
metadata.override = true, metadata.affected_bets = N, metadata.payout_delta = X
```

**New server fn**: `src/lib/adminOverride.functions.ts` → `adminOverrideResult`
- `requireSupabaseAuth` middleware
- Re-checks admin role via service-role lookup (same pattern as `adminDeclareResult`)
- Zod-validates `{ marketId, sessionDate, session, newPana, reason, confirm }`
- Calls the new RPC, returns `{ ok, oldPana, newPana, winners, losers, payoutDelta }`

### Frontend

**New component**: `src/components/admin/declare/HardOverrideDialog.tsx`
- Red-themed Dialog (not the gold/glass styling of CorrectResultDialog).
- Top banner: "⚠ Hard Override — bypasses the 10-minute window and re-settles all bets. Users may have already withdrawn winnings."
- Fields: New Pana, Reason (min 20 chars), checkbox "I understand this re-settles all bets and may produce negative balances", text confirm `"OVERRIDE"`.
- Submit button stays disabled until all three are satisfied.
- On success: toast with payout delta, invalidate `["admin", "declared"]` and `["admin", "history"]` queries.

**Wiring**: In `DeclaredTodayPanel` and `results.history.tsx`, add a second row action "Hard override" (icon: `AlertTriangle`) next to the existing "Correct" button. The existing Correct button stays for the 10-min window; the new one is always enabled for declared rows.

### Out of scope

- No change to the existing `CorrectResultDialog` / `correct_result` flow.
- No DB change to allow negative balances; the function will refund wins by reducing balance even if it goes negative — same behavior as today's `correct_result`.

---

## Part 2 — End-to-End Test Pass (build, after Part 1 ships)

Test account: `qa+e2e@lovable.test`, password `TestPass!2026`. All actions performed via the browser tool against the preview URL.

| # | Flow | Steps | What I verify |
|---|------|-------|---------------|
| 1 | Signup (email+password) | `/register` → fill form → submit | Account row in `auth.users`, `profiles` + `user_roles` rows auto-created |
| 2 | Linked accounts | Sign in → `/linked-accounts` → confirm identities list loads, "Link Google" disabled state, email/phone OTP inputs render | UI renders, no console errors |
| 3 | Forgot password | `/forgot-password` → enter email → check `auth_logs` | recovery email request logged |
| 4 | Deposit | `/wallet` → request ₹500 deposit via UPI → admin approves in `/admin/deposits` | `deposit_requests.status='APPROVED'`, `profiles.balance += 500`, `wallet_transactions` row inserted |
| 5 | Place bet | `/markets` → pick an open market → place ₹50 single-digit bet | `bets` row with status `PENDING`, balance debited |
| 6 | Admin declare (normal path) | Log in as admin → `/admin/results/declare` → declare the market's session | Bets settle to `WON`/`LOST`, balances updated |
| 7 | **Hard override (new)** | Same market → "Hard override" → enter different pana + reason | Old win reversed, new settlement applied, audit_log shows `ADMIN_HARD_OVERRIDE`, system_alerts row appears |
| 8 | Quick play | `/play/quick` → place ₹20 quick bet → wait/admin-declare quick round | `quick_bets` settled |
| 9 | Withdrawal | `/wallet` → request ₹200 withdrawal → admin approves in `/admin/withdrawals` | `withdrawal_requests.status='APPROVED'`, balance debited |
| 10 | Self-exclusion | `/settings/limits` → set daily bet limit ₹100 → try to bet ₹500 | Bet blocked with limit message |
| 11 | Admin panels smoke | Open every admin page (`bets`, `users`, `kyc`, `monitoring`, `risk`, `broadcasts`, `payments`, `support`) | Each loads without console errors |
| 12 | Logout + remember-me | Log out → log back in with "remember me" off → close tab logic | Session cleared as expected |

After the run I'll write a short report: ✅/❌ per flow, screenshots of any failures, and the test account's final DB state (balance, bet count, ledger entries) read via `supabase--read_query`. Test data is left in place per your choice.

Destructive flows I'll skip without explicit OK: deleting the test user, hard-overriding any market that has real (non-test) bets attached.

---

## Files touched (Part 1)

- `supabase/migrations/<new>_admin_override_result.sql` — new RPC + grants
- `src/lib/adminOverride.functions.ts` — new server fn
- `src/components/admin/declare/HardOverrideDialog.tsx` — new component
- `src/components/admin/declare/DeclaredTodayPanel.tsx` — add action button
- `src/routes/admin/results.history.tsx` — add action button