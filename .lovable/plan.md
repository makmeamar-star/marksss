# Push notifications for declared results

## What you'll get
- A bell toggle on every market card (and a master switch in Settings) to subscribe to result alerts.
- Browser/PWA push notifications fired the moment a result row flips to `DECLARED` for any of your selected markets.
- Notifications deep-link to `/results` (or `/charts/$marketId` if available) when tapped.

## Pieces to build

### 1. Database (one migration)
- `push_subscriptions` — `id, user_id, endpoint (unique), p256dh, auth, user_agent, created_at`. RLS: user can CRUD their own; service role can read all (for sending).
- `market_alert_preferences` — `user_id, market_id, enabled, created_at`, primary key `(user_id, market_id)`. RLS: user-only.
- DB trigger `on_market_result_declared`: AFTER UPDATE on `market_results` when `OLD.status <> 'DECLARED' AND NEW.status = 'DECLARED'` → calls `pg_net.http_post` to a public route `/api/public/hooks/dispatch-result-push` with `{ market_id, session_date }` and a shared `x-internal-secret` header.

### 2. VAPID keys
Web push needs a VAPID keypair. I'll generate them in the sandbox (web-push CLI). You'll add:
- `VAPID_PRIVATE_KEY` as a project secret
- `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` (e.g. `mailto:you@domain`) — public key can live in code, but secret keeps it consistent
- `PUSH_DISPATCH_SECRET` — random string the trigger sends and the route verifies

### 3. Server functions / routes
- `subscribePush.functions.ts` — accepts the browser PushSubscription JSON, upserts into `push_subscriptions` for the current user.
- `unsubscribePush.functions.ts` — deletes by endpoint.
- `setMarketAlert.functions.ts` — toggles a row in `market_alert_preferences`.
- `getMarketAlerts.functions.ts` — returns the user's enabled market IDs (for hydrating UI).
- `src/routes/api/public/hooks/dispatch-result-push.ts` — verifies `x-internal-secret`, looks up subscribers for the market via `market_alert_preferences`, joins `push_subscriptions`, joins `markets` for display name, sends a Web Push to each endpoint using `web-push`. Removes endpoints that 404/410 (gone).

### 4. Service worker (`public/sw.js`)
Add `push` and `notificationclick` handlers:
- `push`: parse JSON `{ title, body, url, tag }`, show a notification with the gold crown icon and `tag = market_id+session_date` to dedupe.
- `notificationclick`: focus an existing client at `url` if present, else `clients.openWindow(url)`.

### 5. UI
- `useResultAlerts()` hook — wraps subscription flow: requests `Notification.permission`, calls `swReg.pushManager.subscribe({ applicationServerKey })`, posts to `subscribePush`. Persists per-market enabled set via `setMarketAlert`/`getMarketAlerts` (TanStack Query).
- `<ResultAlertBell market={m} />` — small bell icon overlay on `ResultCard`. Off → outline; On → filled gold. First click triggers OS permission prompt; subsequent toggles just flip the DB row.
- `Settings → Alerts` block — list of currently enabled markets with quick disable, plus "Disable all alerts" (unsubscribes the endpoint).
- Iframe/preview guard reused from existing SW registration so notifications never request permission inside the Lovable editor.

## Limitations to call out
- **iOS only sends web push when the app is added to the Home Screen** (PWA). Android Chrome works in regular browser tabs.
- **Lovable editor preview** can't request notification permission (cross-origin iframe). You'll test on the published URL or installed PWA.
- A user must visit the site at least once after enabling so their endpoint registers. Stale endpoints are pruned automatically when push send returns 410.

## Files
- migration: `push_subscriptions`, `market_alert_preferences`, trigger, helper SQL
- `src/lib/push.functions.ts` (subscribe / unsubscribe / setAlert / getAlerts)
- `src/routes/api/public/hooks/dispatch-result-push.ts`
- `src/hooks/useResultAlerts.ts`
- `src/components/ResultAlertBell.tsx`
- edits to `src/components/ResultCard.tsx` (mount bell), `public/sw.js` (push handlers), `src/routes/_authenticated/settings.limits.tsx` or new `settings.alerts.tsx`
- `bun add web-push` (Worker-compatible — uses Web Crypto, no native deps)

## What I need from you (one decision)
Pick where alert toggles live — that's the only product question. The VAPID keys I'll generate and prompt you to paste back as secrets.
