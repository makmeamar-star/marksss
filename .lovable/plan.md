# Promote real admin + demo login toggle

## 1. Make `lafxnga@gmail.com` a real admin
The user already exists (id `254b681e-…b5412bad36d6`, username `LAFXNGA`).

- On implementation, request the new password through the secure secret prompt (value never appears in chat). Secret name: `LAFXNGA_ADMIN_PASSWORD`.
- Reset the auth password for that user via the Supabase Admin API using that secret.
- Insert `('254b681e-…', 'admin')` into `public.user_roles` (idempotent — skip if already present).
- Confirm in chat once done; you log in via the normal Sign In form with email `lafxnga@gmail.com` + the password you provided.

## 2. Toggle to show/hide demo login on the login page
A single global flag, controlled from the admin dashboard, that turns the "Demo User" / "Demo Admin" buttons on or off for everyone.

### Storage
Reuse the existing `app_settings` table:
- key: `demo_login_enabled`
- value: `{ "enabled": true | false }`
- Defaults to `true` if the row is missing (preserves current behavior).

Add one RLS policy so unauthenticated visitors on `/login` can read this single key (everything else in `app_settings` stays admin-only):
- `Anyone reads demo_login flag` — SELECT for `public` where `key = 'demo_login_enabled'`.

### Login page (`src/routes/login.tsx`)
- On mount, fetch the flag once. While loading, hide the "Demo test accounts" divider and both buttons.
- If `enabled === false`, do not render the divider, the two buttons, or the demo helper text.
- If `enabled === true`, render exactly what's there today.

### Admin dashboard (`src/routes/admin/index.tsx`)
- Add a "Demo login" card with:
  - A `Switch` showing the current state (read from `app_settings`).
  - Helper text: "When off, the Demo User and Demo Admin buttons are hidden from the public login page."
- Toggling the switch upserts the row in `app_settings` (admin-only via existing RLS) and shows a toast.

## Technical details

- **Password reset**: server function (`createServerFn`) using `supabaseAdmin.auth.admin.updateUserById(userId, { password })`, reading `process.env.LAFXNGA_ADMIN_PASSWORD`. Run once at implementation time, then the secret can stay (or be removed) — the password lives in Supabase Auth.
- **Role insert**: `INSERT INTO user_roles (user_id, role) VALUES ('254b681e-fe0f-4b17-816d-b5412bad36d6', 'admin') ON CONFLICT (user_id, role) DO NOTHING;`
- **Migration**: only adds the public-read RLS policy on `app_settings` scoped to `key = 'demo_login_enabled'`. No schema changes.
- **Client read**: simple `supabase.from('app_settings').select('value').eq('key','demo_login_enabled').maybeSingle()` in both the login page and the admin toggle card.

## Out of scope
- No changes to the demo accounts themselves or to the existing "Remember me" behavior.
