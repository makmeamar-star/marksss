## Goal

1. Backfill historical market results so the public Results / Charts pages show real history for Kalyan and every other market.
2. Add an admin Markets page to create, edit, and remove markets (games) from the admin dashboard.

## 1. Backfill historical results

Seed ~90 days of past `market_results` for all 8 existing markets (Kalyan, Madhur Day, Main Mumbai, Milan Day, Milan Night, Rajdhani Day, Rajdhani Night, Time Bazar).

- For each market × each past day (skipping days not in the market's `days` array): pick a random valid `open_pana` and `close_pana` from `pana_chart`, derive `open_digit`, `close_digit`, `jodi`.
- Insert rows with `status = 'DECLARED'`, `declared_at = session_date + close_time`, `declared_by = NULL` (system seed).
- Idempotent: skip dates that already exist.
- Done via a one-off SQL `INSERT ... SELECT` using `ON CONFLICT DO NOTHING` (after confirming a unique index on `(market_id, session_date)`; add it if missing).

This only affects historical display data. No bets, wallets, or audit settling logic runs.

## 2. Admin "Manage Markets" feature

### Database
Markets table already has full CRUD-friendly columns and admin-only RLS (`Admins write markets`). No schema change needed beyond optionally adding a soft-delete safety: we'll keep hard delete but block it server-side if any `bets` or `market_results` reference the market — instead set `status = 'INACTIVE'`.

Add a SECURITY DEFINER function `admin_delete_market(_market_id text)` that:
- Requires admin role.
- If referenced by bets/results → updates `status='INACTIVE'` and returns `{ soft: true }`.
- Else deletes the row and its `market_automation` entry, returns `{ soft: false }`.

### UI
New route `src/routes/admin/markets.tsx`:
- Table of all markets with: display name, id, open/close, days, min/max bet, status.
- "Add Market" button → dialog with form (id, display_name, name, open_time, close_time, result_time, days multi-select Mon–Sun, min_bet, max_bet, payouts JSON with sane defaults pulled from an existing market as template).
- Row actions: Edit (same dialog prefilled), Activate/Suspend toggle (flips `status`), Delete (calls `admin_delete_market` RPC, shows toast indicating hard vs soft delete).
- Also auto-creates a `market_automation` row (disabled) when a market is added.

Add a new tile on `src/routes/admin/index.tsx` linking to `/admin/markets`.

### Validation
- `id`: lowercase, kebab-case, unique.
- `open_time` < `close_time`, both `HH:MM`.
- `payouts` defaulted from Kalyan's payouts so admin doesn't need to type JSON for normal use; advanced JSON editor available.

## Technical notes
- Migrations:
  1. Add unique index `market_results_market_session_uniq` on `(market_id, session_date)` if missing.
  2. Create `admin_delete_market` function.
  3. Seed historical results (90 days, all markets).
- Frontend uses `supabase` client directly (admin RLS already enforced).
- No changes to bet settlement, automation, or public pages required — Results/Charts pages will simply start showing data.

## Out of scope
- Editing past results (already covered by `correct_result` within 10-min window for current day).
- Bulk import from external sources.
