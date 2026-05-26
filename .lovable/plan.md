## Problem

Admin (lafxnga@gmail.com — confirmed `admin` row in `user_roles`) opens `/admin/results/declare` and is bounced with **403 → /login**. The `Declare Result` feature itself stays — we just need to stop the guard from wrongly rejecting real admins.

Root cause is in `src/routes/admin.tsx` `beforeLoad`:

1. **Fast path is too aggressive.** If `hydrated && user && user.role !== "ADMIN"`, it *immediately* redirects with no server check. On a fresh page load the auth store can become `hydrated` before the user object is replaced by the freshly-loaded admin profile (or briefly carries a stale `USER` role), so a real admin gets bounced without any server verification.
2. **SSR fallback is fragile.** When `requireAdminSSR()` runs during SSR/preview prerender, the `sb-access-token` cookie set by `useAuthCookieSync` isn't present yet (cookie is written client-side after mount), and no Bearer header is attached during `beforeLoad`. It returns `{ok:false}` → redirect.
3. **`try/catch` swallows `redirect()`.** The outer `try { await requireAdminSSR() } catch {}` would also swallow any thrown TanStack `redirect`, masking signal.

## Plan

### 1. Harden `/admin` beforeLoad (`src/routes/admin.tsx`)
- Remove the "fast-path auto-redirect when role !== ADMIN" branch. Only treat the store as authoritative for the **positive** case (role IS admin → allow). On negative/unknown, fall through to a server check.
- If `!hydrated` on the client, `await useAuthStore.getState().bootstrap()` (idempotent) before deciding, so we never make the redirect decision on a half-loaded store.
- After the server check, on failure, re-query `user_roles` one more time via the browser supabase client as a last-chance check (RLS already allows users to view own roles). This catches the SSR-cookie-missing case without a false 403.
- Use `isRedirect(e)` in the `catch` so redirects aren't swallowed.

### 2. Make `requireAdminSSR` also accept the standard Bearer header path reliably
- Already does; but add a small change: when neither header nor cookie is present, return `{ok:false, reason:"no-token"}` so the client can distinguish "really not admin" vs "no session yet" and avoid an immediate redirect on the latter.

### 3. Keep `Declare Result` UI and manual declare flow exactly as-is
- No changes to `src/routes/admin/results.declare.tsx`, `DeclareButton.tsx`, or `adminDeclareResult.functions.ts`. Manual admin declare stays the primary way to publish a result.

### 4. Verify
- After edit, hard-refresh `/admin/results/declare` while logged in as `lafxnga@gmail.com`; confirm page loads (no 403).
- Trigger a manual declare on any pending market and confirm: declared row appears, settlement runs, toast success.
- Sign out and visit `/admin/results/declare` → still correctly redirected to `/login` with toast (true negative still works).

## Out of scope
- Scraper / auto-declare cron (already addressed in previous turn, awaiting publish).
- Hydration mismatch warning on `HomePage` ("15" vs "0") — separate issue.
- Any restyle of the declare page.

## Files touched
- `src/routes/admin.tsx` — relax fast-path, add bootstrap await, add fallback role re-check, respect `isRedirect`.
- `src/lib/adminGuardSSR.functions.ts` — return reason flag (tiny additive change).
