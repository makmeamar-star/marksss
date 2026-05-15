## Problem

`/admin` and its sub-pages render briefly (or fully on a fresh tab) without a logged-in admin session because:

1. The route guard skips the check during SSR/prerender (`if (typeof window === "undefined") return;`), so the admin shell HTML is generated and shipped to the browser.
2. The client-side check is async and runs after render, so anyone hitting `/admin` directly sees the admin layout flash before the redirect.
3. Login always sends people to `/dashboard` regardless of role — there's no role-aware routing on success.
4. There is no server-side enforcement for admin pages; everything relies on RLS at query time.

RLS itself looks correct (admin tables use `has_role(auth.uid(), 'admin')`), but the UI layer is leaking.

## Fix

### 1. Harden the `/admin` route guard (`src/routes/admin.tsx`)

- Keep the SSR early-return, but render a **blank gate component** (`return null` until hydrated + verified) instead of the admin shell. No admin HTML ever paints until the role check resolves.
- In `beforeLoad`, after `getSession()`:
  - If no session → `redirect({ to: "/login", search: { redirect } })`.
  - If session but role check returns no `admin` row → `redirect({ to: "/dashboard" })` + toast "Admin access required".
- Add a `loader` that calls a new server function `requireAdmin()` so the role is also verified **server-side** (defence in depth — a tampered client can't fake the role).

### 2. New server function `requireAdmin` (`src/lib/admin.functions.ts`)

```ts
export const requireAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles").select("role")
      .eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (error || !data) throw new Error("FORBIDDEN");
    return { ok: true };
  });
```

The `/admin` loader calls this; non-admins get the route's `errorComponent` which redirects to `/dashboard`.

### 3. Role-aware login redirect (`src/routes/login.tsx`)

After every successful login (form, demo user, demo admin), look up the user's role:

```ts
const { data: roles } = await supabase.from("user_roles")
  .select("role").eq("user_id", session.user.id);
const isAdmin = (roles ?? []).some(r => r.role === "admin");
navigate({ to: isAdmin ? "/admin" : "/dashboard" });
```

This removes the hard-coded `/admin` jump from the Demo Admin button (which no longer holds admin after the previous change) and routes the real admin (`lafxnga@gmail.com`) to `/admin` automatically.

Also: if `/login` is opened while already authenticated, redirect immediately based on role (covers the "open /admin in a new tab without login" case — they end up on /login → bounced to /dashboard).

### 4. `_authenticated` guard hardening (same approach as admin)

Same pattern: don't render the layout shell until session is verified post-hydration. Prevents player pages flashing on a logged-out tab too.

### 5. Sanity sweep on RLS (read-only)

Run `supabase--linter` and confirm:
- Every admin-only table has policies gated by `has_role(auth.uid(), 'admin')` (already true based on schema dump).
- No table has a `USING (true)` write policy.
- `user_roles` itself is locked down (it is — only admins can write).

If the linter surfaces anything, fix it in a follow-up migration.

### 6. Out of scope (not changing)

- Existing RLS policies — they're already correct.
- The "Demo Admin" button stays visible (per earlier decision) but will now redirect to `/dashboard` since that account is no longer admin.
- No change to authStore persistence / "Remember me".

## Files touched

- `src/routes/admin.tsx` — gate component, server-side role loader, error redirect.
- `src/routes/_authenticated.tsx` — render gate post-hydration.
- `src/routes/login.tsx` — role-aware post-login redirect + already-signed-in redirect.
- `src/lib/admin.functions.ts` — **new** `requireAdmin` server function.
- `src/start.ts` — verify `attachSupabaseAuth` is registered (already required for any auth-protected serverFn; add only if missing).

## Result

- Visiting `/admin` without a session → instant redirect to `/login`, no admin HTML paints.
- Logged-in non-admin hitting `/admin` → redirected to `/dashboard`.
- Real admin (`lafxnga@gmail.com`) signs in → lands directly on `/admin`.
- Even with client-side tampering, the loader's server-side `requireAdmin` blocks the page.
- RLS continues to protect data at the database layer.