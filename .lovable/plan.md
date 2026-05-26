# Simplify Admin + Harden Declare / Automation / Scrape

Goal: make the admin console focused on daily ops, and verify the three result-flow pages (Declare, Automation, Scrape) actually work end-to-end.

---

## 1. Hide demo + clutter from the admin dashboard

**`src/routes/admin/index.tsx`**
- Remove the `DemoLoginToggle` section entirely (component + render + `KeyRound` import + the `Switch`/`useQueryClient`/`useState`/`toast` imports it owns).
- Trim Quick-action tiles to the daily-use set:
  Markets, Declare, Automation, Scraper, History, Deposits, Withdrawals, Users.
  Drop: Alerts, Observations, Automation Audit.

**`src/routes/admin.tsx` (sidebar `NAV`)**
- Keep (in this order): Dashboard, Markets, Users, Bets Monitor, Declare Results, Result History, Automation, Scraper, Deposits, Withdrawals, Payment Channels, Customer Support, KYC Review.
- Move into a collapsed "Advanced" group at the bottom (still reachable, just out of the way): Automation Runs, Automation Audit, Broadcasts, Risk & Ops, Monitoring, PWA Funnel.

**`src/routes/admin/results.declare.tsx`**
- Right column: keep `PendingTodayPanel` + `DeclaredTodayPanel`. Remove `PanaReferencePanel` and `ActivityFeedPanel`.
- Bottom: remove `AuditLogPanel` and `ShortcutsLegend` (shortcuts still work, just no on-screen legend).
- Keep `MissingResultsBanner`, header, `SessionSelectorCard`, `PanaInputCard`, `ImpactPreviewCard`, `DeclareButton`.

**`src/routes/admin/results.scrape.tsx`**
- Drop "Backfill history" card (rarely used, confuses operators).
- Drop "Per-market latest status" table — duplicated by Source coverage.
- Keep: stat tiles, Source coverage with Refresh, "Run scraper now" button, Recent attempts table (limited to 20 rows for readability).

**`src/routes/admin/results.automation.tsx`**
- Remove "Grace (min)" column input and "Last run" column from the main table — leave only Market, Times, Auto OPEN, Auto CLOSE. Grace stays at default in DB.
- Keep "Run scheduler now" button and the explanatory footer.

---

## 2. Debug + harden Declare Result flow

Current behaviour that breaks UX:
- `DeclareButton.handleConfirm` calls `qc.invalidateQueries()` with no key → invalidates *every* query in the app, including auth/profile/markets. That's part of the post-declare lag and occasional UI flashes.
- After a successful server declare, it also runs the local `declareResult()` mirror which can double-toast.

Fix:
- Remove the catch-all `qc.invalidateQueries()`; keep only the targeted keys.
- Only fall back to the local mirror if the server declare succeeded *and* you actually need the digit; otherwise just toast success once and invalidate.
- Surface server error messages verbatim (the RPC returns useful text like "session already declared" — keep it).
- Add a small "Result already declared" guard: before opening confirm dialog, check `DeclaredTodayPanel`'s data; if same market+session already has a pana, switch the CTA to "Correct" via the existing `CorrectResultDialog` path.

## 3. Debug + harden Automation

- The "Run scheduler now" button calls `run_due_auto_declarations` RPC directly. Wire the same call into a small server-fn (`runDueAutoDeclarations`) so it goes through `requireSupabaseAuth` middleware and shows a clear error toast on RLS failure (current direct RPC silently no-ops if the user role check fails).
- Verify a `pg_cron` job exists hitting `/api/public/hooks/auto-declare-results` every minute. If missing, schedule it via the supabase insert tool (not a migration — it embeds the project URL).
- On the page, show next-run countdown using `last_run_at` so admins can tell at a glance the scheduler is alive.

## 4. Debug + harden Scrape

- `runLive` mutation: surface `d.count` per-source breakdown in the toast (`OK: x, NOT_YET: y, ERROR: z`) so admins know whether nothing came back vs everything failed.
- Add per-market Refresh failure path: today errors render as raw text — switch to the same `StatusBadge` styling.
- Verify the `/api/public/hooks/scrape-results` cron job is scheduled every 2–3 minutes. If not, schedule it.
- Verify `HOOK_SECRET` env var exists on the worker; if not, prompt to add via `add_secret` (blocks scrape from running).

## 5. Verification

After the edits:
1. Load `/admin` — confirm Demo toggle is gone, tile grid is 8 items, sidebar is shorter.
2. Open `/admin/results/declare`, declare a test pana → single success toast, panels update without full-app refetch.
3. Open `/admin/results/automation`, hit "Run scheduler now" → toast shows ran count.
4. Open `/admin/results/scrape`, hit "Run scraper now" → toast shows attempt count + status breakdown.
5. Check `cron.job` table to confirm scrape + auto-declare jobs are scheduled.

---

## Out of scope
- Auth flow further tuning (already done in previous pass).
- Re-skinning admin pages.
- Adding new features beyond what's listed.

If you want even fewer sidebar items or a different set of "daily use" tiles, say the word and I'll trim further before building.
