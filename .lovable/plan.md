## Admin Result Declaration Page — `/admin/results/declare`

Build the spec exactly as described, wired to the **existing mock stores** (`marketStore`, `betStore`, `walletStore`, `notificationStore`) and the existing pana validator + settlement engine. Backend API routes and Socket.io are documented as mock equivalents now and will be swapped to the real Express/Prisma backend during the Phase 5 handoff.

### 1. Admin shell (prereq)
- Create `src/routes/admin.tsx` as a pathless layout: auth guard (require `role === "ADMIN"`), gold-accented sidebar (Dashboard, Markets, **Results › Declare / History / Audit**, Bets, Users, Deposits, Withdrawals, Broadcasts, Reports), top breadcrumb + live IST clock component.
- Demo "Login as Admin" already promotes role on the login page.

### 2. Pana validator extensions (`src/lib/panaChart.ts`)
Add to existing module (keep current API, just extend):
- `getSuggestedPanas(input: string)` — permutation-based, returns up to 5 valid panas.
- `getPanasForDigit(d)` returning `{ single, double, triple }`.
- `panaTypeBadge` color map.
No backend swap needed — this file is already designed to be drop-in for the Express server.

### 3. Mock "API" layer (`src/lib/adminApi.ts`)
Thin async wrappers (returning Promises with ~50 ms delay) over zustand reads/writes so the page code mirrors the real REST shape it'll have in Phase 5:
- `pendingToday()` → derives from markets vs results today.
- `declaredToday()` → from `useMarketStore.results` filtered to today + adds `correctionWindowOpen` (10 min).
- `validatePana(pana)` → uses `isValidPana`/`getSuggestedPanas`.
- `impactPreview({ marketId, sessionDate, session, pana })` → reads pending bets from `betStore`, runs `settleBets()` with a synthetic `ResolvedResult` (merging existing open if declaring close), groups by bet type, masks usernames, flags `HIGH_PAYOUT` when payout > 1.5× bet collection.
- `declareResult({...})` → writes into `marketStore.upsertResult`, runs `settleBets`, credits winners via `walletStore.pushTransaction` + `authStore.bumpStats` for the active demo user, emits `notificationStore` events, fires `betStore.lastWin` if current user won.
- `correctResult({ sessionId, newPana, reason })` → reverses prior settlement, re-runs, appends audit entry, pushes correction notifications.
- `auditLog({ days })` → reads from a new `useAuditStore`.

### 4. New stores
- `src/stores/auditStore.ts` (Zustand+persist): `entries: AuditEntry[]` with `{ id, ts, adminId, action: 'DECLARED'|'CORRECTED'|'CANCELLED', marketId, session, oldPana?, newPana?, reason?, betsAffected, payout }`.
- `src/stores/realtimeStore.ts` (in-memory, no persist): `events: ActivityEvent[]` (last 50). Mock pub/sub: `emit(event)` pushes; subscribers re-render via Zustand selector. `adminApi.declareResult` and `correctResult` emit `result:declared`, `settlement:complete`, `bet:settlement:batch`, `result:corrected`. This is the "WebSocket" stand-in.

### 5. Page route — `src/routes/admin/results.declare.tsx`
Two-column responsive layout (`lg:grid-cols-5` → 3/2 split, mobile stacked).

**Header bar**
- `Trophy` icon + "Result Declaration" / subtitle / breadcrumb / "View Result History" → `/admin/results/history` (stub route created).
- `LiveClock` component: `Tuesday, 05 May 2026 — 14:32:07 IST` with `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', … })`, ticks every 1 s, `suppressHydrationWarning` to avoid SSR mismatch.

**Left column components (in `src/components/admin/declare/`)**
1. `SessionSelectorCard.tsx` — date picker (shadcn DatePicker, future disabled), Open/Close pill toggle, searchable Market `Combobox` grouped Pending / Already Declared with colored status dots; below: `SessionInfoBar` showing market times + "Total bets: N · ₹X at stake · Awaiting result declaration".
2. `PanaInputCard.tsx` — three 80×80 digit boxes (`<input type="text" inputMode="numeric" maxLength={1}>`), refs for auto-advance + backspace + paste handler that distributes 3 chars; toggle to "Single field" mode (single 3-digit input formatted with spaces). Border colors swap by validation state. Below input:
   - Valid block: green card with sum-calculation, animated `DigitCircle` (Framer Motion spring scale + `useMotionValue` count-up to digit), pana-type badge (SP/DP/TP).
   - Invalid block: red card with explanation + "Did you mean…" suggestions (clickable chips that fill the input).
   - Inline reference row: "Valid panas for digit X:" highlighting the entered pana.
   - `JodiCalculation` component — visible only when declaring CLOSE and an OPEN result already exists (or vice-versa); animated.
3. `ImpactPreviewCard.tsx` — `useQuery({ queryKey: ['impact', marketId, session, pana], queryFn, enabled: validPana, staleTime: 30s })` with 500 ms `useDebounce`. Renders table by bet type, totals, top-5 winners (masked), warning banner when `HIGH_PAYOUT`. Skeleton while loading.
4. `DeclareButton.tsx` — full-width gold button with pulse glow when enabled; opens `ConfirmDeclareDialog` (shadcn `Dialog`) requiring user to type `CONFIRM` before "Declare Now" enables; shows full summary; on submit calls `adminApi.declareResult`, shows confetti via existing `WinCelebration`-style burst, success toast, resets form.

**Right column components**
5. `PendingTodayPanel.tsx` — auto-refresh via `useQuery({ refetchInterval: 60_000 })`; rows colored by overdue/due-soon/later; "Declare Now →" wires market+session into form via shared `useDeclareForm` Zustand local store.
6. `DeclaredTodayPanel.tsx` — list of today's declared sessions, "Correct Result" link visible if within 10 min; opens `CorrectResultDialog`.
7. `PanaReferencePanel.tsx` — pill tabs 0–9, shows SP/DP/TP groups; search box; auto-scrolls/highlights when matching the live pana input (subscribe to shared form store).
8. `ActivityFeedPanel.tsx` — subscribes to `realtimeStore.events`, AnimatePresence slide-in from top, last 10 entries with relative time (`date-fns/formatDistanceToNow`), green pulsing live dot.

**Bottom**
9. `AuditLogPanel.tsx` — collapsible (`Accordion`), table columns per spec, filter chips, CSV export (Blob download); reads `useAuditStore`.

**Footer legend**
10. `ShortcutsLegend.tsx` — small bottom strip listing Alt+1, Alt+2, Alt+D, Alt+C, Esc, Tab, Enter; bound via `useEffect` global `keydown` listener (`useShortcuts.ts`).

### 6. Result Correction flow (`CorrectResultDialog.tsx`)
- Shows current declared pana + 10-minute countdown progress bar (`useEffect` interval).
- Same 3-box pana validator, required `reason` textarea (≥10 chars).
- Calls `adminApi.correctResult` → reverses prior wallet credits, re-settles, pushes "Result corrected" notifications to all affected user IDs, appends audit entry.

### 7. Edge cases (all handled in `adminApi`)
- Double submit → `inFlight` ref + idempotency: `declareResult` short-circuits with existing result if same `marketId+date+session`.
- Already declared → form switches into "Show declared, offer correction" state.
- Suspended market → declaration disabled, banner shown.
- Zero bets → success path with "no settlements needed" message.
- `000` pana → handled (input keeps leading zeros, validator already accepts).
- Midnight rollover → `sessionDate` derived from picker not `Date.now()`.
- Form persistence → `useDeclareForm` mirrors to `sessionStorage` so a forced re-login restores state.
- High payout > 5× daily avg → extra red modal + "Requires secondary admin approval" toggle (mock checkbox in dialog).

### 8. New files
```
src/routes/admin.tsx                                  (admin layout)
src/routes/admin/index.tsx                            (admin dashboard stub)
src/routes/admin/results.declare.tsx                  (this page)
src/routes/admin/results.history.tsx                  (stub for back-link)
src/components/admin/AdminSidebar.tsx
src/components/admin/LiveClock.tsx
src/components/admin/declare/SessionSelectorCard.tsx
src/components/admin/declare/PanaInputCard.tsx
src/components/admin/declare/DigitCircle.tsx
src/components/admin/declare/JodiCalculation.tsx
src/components/admin/declare/ImpactPreviewCard.tsx
src/components/admin/declare/DeclareButton.tsx
src/components/admin/declare/ConfirmDeclareDialog.tsx
src/components/admin/declare/CorrectResultDialog.tsx
src/components/admin/declare/PendingTodayPanel.tsx
src/components/admin/declare/DeclaredTodayPanel.tsx
src/components/admin/declare/PanaReferencePanel.tsx
src/components/admin/declare/ActivityFeedPanel.tsx
src/components/admin/declare/AuditLogPanel.tsx
src/components/admin/declare/ShortcutsLegend.tsx
src/hooks/useDebounce.ts
src/hooks/useShortcuts.ts
src/stores/declareFormStore.ts
src/stores/auditStore.ts
src/stores/realtimeStore.ts
src/lib/adminApi.ts
```

### 9. Files edited
- `src/lib/panaChart.ts` — add `getSuggestedPanas`, `getPanasForDigit`.
- `src/styles.css` — add `--gold-glow`, `pulse-gold` keyframe utility for Declare button + activity-feed pulsing dot.
- `src/stores/betStore.ts` — expose `bets` filter helper used by impact preview.

### 10. Out of scope (deferred)
- Real Socket.io / Express endpoints (Phase 5 handoff doc lists each endpoint above).
- Real auth role middleware (mocked via `useAuthStore.role`).
- PDF export of audit log (CSV only for now).

Approve to start building.