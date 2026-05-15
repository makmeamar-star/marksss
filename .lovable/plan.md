## Goal

Make `lafxnga@gmail.com` the sole admin. Revoke admin from everyone else.

## Current admins

| Email | Username |
|---|---|
| lafxnga@gmail.com | LAFXNGA ✅ keep |
| imamarmeena@gmail.com | meena_admin ❌ remove |
| admin@sattaking.test | demo_admin ❌ remove |
| owner@sattaking.app | owner ❌ remove |

## Changes

1. Delete the 3 non-LAFXNGA rows from `user_roles` where `role = 'admin'`. The user accounts remain (they can still log in as regular users); only the admin privilege is revoked.
2. `lafxnga@gmail.com` keeps the existing `admin` role, which already grants full control via existing RLS policies (`has_role(auth.uid(), 'admin')` on every admin-gated table).

## Heads-up about the Demo Admin button

The login page has a "Demo Admin" quick-login that signs in as `admin@sattaking.test`. After this change, that account will no longer have admin powers — the button will log in as a normal user. Two options:

- **A. Leave it** — Demo Admin button just becomes a regular demo user. (Simplest.)
- **B. Hide the Demo Admin button** entirely on the login page.

I'll proceed with **option A** unless you say otherwise in the next message.

## Technical

Single SQL statement via the data tool:

```sql
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id <> '254b681e-fe0f-4b17-816d-b5412bad36d6';
```

No schema changes, no code changes.