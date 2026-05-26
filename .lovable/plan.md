# Direct Sign-In as the Primary Entry Point

Replace the "create an account" friction with a single sign-in surface. Every method (Google, Apple, email OTP, phone OTP, email+password) auto-creates the account on first use. The dedicated registration form stays available as a fallback but is no longer the default.

## What changes for the user

- Landing CTA "Create Account" / "Sign Up" buttons → "Sign In" (single button everywhere).
- `/register` no longer linked from the header, hero, or empty states. The route still exists for users who land on it via old links.
- `/login` becomes the one-stop screen:
  - **Continue with Google** (already wired)
  - **Continue with Apple** (already wired, Lovable-managed)
  - **Email** tab → email + 6-digit OTP (no password step; account is created automatically on first verify)
  - **Phone** tab → mobile + 6-digit OTP (account auto-created)
  - Small "Use password instead" link reveals the existing password form for returning users
- Footer of `/login`: "New here? You'll be signed up automatically." (replaces "Don't have an account? Register")

## What stays the same

- Auth backend, RLS, profile auto-creation trigger, admin role for khanchitku67@gmail.com.
- `/forgot-password` and `/reset-password` flows.
- `/register` route file (kept for deep links and for users who explicitly want the full form with referral code) — just hidden from primary nav.

## Files to touch

- `src/routes/login.tsx` — reorder tabs so Email-OTP is the default, demote password form behind a toggle, update footer copy, ensure social buttons are above tabs.
- `src/routes/index.tsx` and `src/components/SiteHeader.tsx` (or equivalent) — change every "Create Account" / "Register" CTA to "Sign In" pointing at `/login`.
- `src/routes/register.tsx` — add a top banner "Most people just sign in — it creates your account automatically. [Sign in instead]" linking to `/login`. No logic change.
- Hydration mismatch fix on `/` (the `15` vs `0` counter on home) — wrap the dynamic number in a client-only render so SSR and CSR agree. Unrelated to auth but currently spamming the console.

## Out of scope

- No DB migrations.
- No changes to admin guard, results declare, or audit log.
- SMS provider still not configured — phone OTP UI works but won't send until Twilio/MSG91 is added in Cloud → Auth.

## Acceptance

1. Visiting `/` shows only "Sign In" (no "Create Account" anywhere primary).
2. `/login` opens with Google + Apple buttons on top, Email OTP tab selected by default.
3. Entering a brand-new email on the Email tab → receive OTP → verify → account is created (profile + role rows via existing trigger) and user lands on dashboard.
4. Same for a brand-new phone number once SMS is configured.
5. `/register` still works for anyone who reaches it directly.
