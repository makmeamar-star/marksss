## What's wrong today

This app uses **Supabase Auth via Lovable Cloud** (email+password, Google & Apple via the Lovable broker, phone OTP UI already present). The "account already exists" error happens because the `handle_new_user` trigger creates a `profiles` row using `split_part(email,'@',1)` as the username when none is provided. `profiles.username` is `NOT NULL` (and unique in app logic), so the **second** person whose email local-part collides (e.g. two different `rohan@...` addresses) — OR a returning user whose previous signup half-completed — gets a duplicate-key error that surfaces as "already exists". `register()` in `authStore` then bubbles the Supabase error verbatim. Email confirmation is also on, so re-attempting with an unverified email also looks like "already exists".

## Plan

### 1. Fix the signup trigger (DB migration)
- Make `handle_new_user` generate a **unique username** by appending a short random suffix when there's a collision (loop until insert succeeds, max 5 tries, fallback to `user_<6hex>`).
- Make it idempotent: `INSERT ... ON CONFLICT (user_id) DO NOTHING` for both `profiles` and `user_roles`, so re-sent confirmations / OAuth merges don't 23505.
- Same loop used for OAuth signups (Google/Apple have no username in metadata).

### 2. Fix `/register` UX
- Catch Supabase `user_already_exists` / `email_exists` and show a friendly message with a "Sign in instead" + "Forgot password?" link, instead of the raw error.
- Show a clear "Check your email to confirm" state when sign-up succeeds but session is null (email confirmation pending).

### 3. Forgot-password & account recovery
- Already partly there: `/login` has a "Forgot password?" button and `/reset-password` exists. Polish:
  - Build a dedicated **`/forgot-password`** route (email input → `supabase.auth.resetPasswordForEmail` with `redirectTo=/reset-password`) with success state.
  - Harden **`/reset-password`** to detect the `type=recovery` URL hash, exchange it for a session, then allow `updateUser({ password })`. Error if opened without a recovery token.
  - Add a "Recover via phone OTP" link on `/forgot-password` (uses the same phone-OTP flow — once verified, user can set a new password from `/reset-password`).
  - Link both from `/login` and `/register`.

### 4. Email OTP signup/login (passwordless option, keeping password too)
- Add a new **"Email OTP"** tab on `/login` next to Email / Phone.
- Flow: user enters email → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` → 6-digit code screen → `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
- On first-time verify, the existing trigger creates the profile; the unique-username loop auto-generates a handle like `rohan_a1b2`. User lands on `/dashboard` immediately.
- Keep the existing password form on the "Email" tab unchanged.

### 5. Direct mobile OTP login
- The UI already exists on the Phone tab — keep it.
- Wire `shouldCreateUser: true` on the `signInWithOtp({ phone })` call so first-time phone users get auto-registered (the trigger fills profile/username from phone digits when email is null — small tweak to `handle_new_user` for the no-email branch).
- Add the same OTP UI on `/register` so phone-first signup works there too.
- ⚠️ SMS won't actually send until you configure a provider (Twilio/MSG91) in Cloud → Auth settings. UI will show "SMS not configured" toast if Supabase returns that error. (You chose "configure later".)

### 6. Google + Apple
- Already wired via `lovable.auth.signInWithOAuth("google" | "apple")`. Apple uses **Lovable managed** credentials (your choice — zero setup).
- I'll call `supabase--configure_social_auth` with `providers: ["google", "apple"]` to make sure both are enabled server-side (prevents the "Unsupported provider" error on first click).

### 7. Misc
- Fix the React error #418 in the runtime errors (an SSR/CSR markup mismatch — likely the conditional inside `/login`'s `beforeLoad` redirect path). Will investigate during build.
- Auto-confirm email signups will stay **off** (default), so users still verify their email — matches the policy in the system prompt.

## Files to touch

- `supabase/migrations/<new>.sql` — rewrite `handle_new_user` (unique-username loop, ON CONFLICT, no-email branch).
- `src/routes/register.tsx` — friendly duplicate handling, "confirm your email" state.
- `src/routes/login.tsx` — add Email-OTP tab; ensure phone OTP uses `shouldCreateUser: true`.
- `src/routes/forgot-password.tsx` — new route.
- `src/routes/reset-password.tsx` — recovery-token guard.
- `src/stores/authStore.ts` — surface clean error codes from `register()`.
- Call `supabase--configure_social_auth` with `["google","apple"]`.

No changes to backend RLS, admin flow, or business logic.
