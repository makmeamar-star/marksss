# Fix: admin dashboard flashes then errors (server-fn 401)

## Root cause

All admin server functions (`getAdminOverview`, `listUsers`, `listBets`, `sendBroadcast`, `listRecentBroadcasts`) are wrapped with `requireSupabaseAuth`, which demands an `Authorization: Bearer <token>` header. The client never attaches that header when calling server functions — TanStack Start's default fetch sends no Supabase token. Result:

```
GET /_serverFn/...  →  401 Unauthorized
```

Browser then receives a thrown `Response` object, surfaces it as `Error: [object Response]`, and the root `errorComponent` renders. That's the "shows dashboard for a sec, then error" behavior.

## Fix

Add a tiny client-side fetch interceptor that attaches the current Supabase access token to every same-origin `/_serverFn/...` request. Load it once at app boot.

### Changes

1. **New file `src/integrations/supabase/server-fn-fetch.client.ts`**
   - On import (browser only), monkey-patches `window.fetch`.
   - For requests whose URL pathname starts with `/_serverFn/`, calls `supabase.auth.getSession()` and, if a session exists, sets `Authorization: Bearer <access_token>` (without overwriting an explicit Authorization the caller already set).
   - No-op on the server.

2. **`src/routes/__root.tsx`**
   - Add `import "@/integrations/supabase/server-fn-fetch.client";` so the patch installs as soon as the client bundle runs.

3. **Hardening (optional but cheap):**
   - Update `src/routes/admin/index.tsx` so the failure case shows a clearer message and a Sign-in CTA when status is 401, instead of throwing into the root error boundary. (Just guard `q.error` rendering — no behavior change for the happy path.)

### Verification

- Reload `/admin` while logged in as the new admin (`owner@sattaking.app`).
- Watch worker logs: `/_serverFn/...` should be `200`, not `401`.
- KPI tiles populate (active users, bets, payout, etc.); markets and activity feed render.
- Visit `/admin/users`, `/admin/bets`, `/admin/broadcasts` — all should load without the error screen.
- Sign out → visit `/admin` → admin layout `beforeLoad` redirects to `/login` (unchanged).

## Out of scope

No DB/schema changes. No changes to RLS or to the `requireSupabaseAuth` middleware. Other admin pages that already use the browser supabase client directly are unaffected.
