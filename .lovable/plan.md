## Plan

### 1) Upgrade withdrawal admin flow

- Add a proper status flow: `PENDING → APPROVED → PAID`, plus `DECLINED` for refused requests.
- Keep balance deduction on `APPROVED` (current behavior), then `PAID` only confirms the actual payout was sent.
- Add admin actions on `/admin/withdrawals`:
  - **Approve** pending withdrawal
  - **Decline** pending withdrawal with reason
  - **Mark Paid** approved withdrawal
- Add tabs/filters for Pending, Approved, Paid, Declined/Rejected.
- Update the user wallet status badges so users clearly see Pending / Approved / Paid / Declined.

### 2) Fix auto-result update accuracy

- Fix the live database constraint that currently rejects `JODI` observations; this is causing errors like `result_observations_session_check` on JODI markets.
- also results are updating on random wrong times. debug this also and resulve issue. 
- Tighten auto declaration so normal markets require at least **2 distinct matching sources** before publishing, instead of the current effective value of 1.
- Update the app setting `auto_declare_min_confirmations` to 2.
- Keep auto results running, but make it safer: conflicting source values should stay un-declared and appear for admin review instead of publishing a possibly wrong result.

### 3) Add a new Manual Result admin tab

- Create a new admin tab: **Manual Results** at `/admin/results/manual`.
- The tab will let admin:
  - Select market, date, session (`OPEN`, `CLOSE`, or `JODI` for jodi-only markets)
  - Enter manual value
  - Declare missing result
  - Override already-declared auto result with reason + confirmation
- Reuse the existing secure server functions where possible, and add/extend backend override support where needed for JODI-only markets.
- Show current declared value and latest scraper observations beside the form so admin can compare before overriding.

### 4) Hide the broken Declare Result tab

- Remove/hide the current **Declare Results** link from the admin sidebar, dashboard tile, and back-links.
- Point admin shortcuts to the new **Manual Results** tab instead.
- Leave the old route file untouched unless needed, so no existing deep link breaks immediately.

### 5) Validation

- Check recent scraper logs after the fix to confirm JODI observations no longer fail.
- Confirm withdrawal status transitions work through admin actions.
- Confirm the old Declare tab is no longer visible from admin navigation and the new Manual Results tab opens without the previous 403/React error.