## Goal

Make login feel instant, the home/results pages snap on first paint, and the admin dashboard scroll/load without spinners — without changing any features.

## What's actually slow (measured from the code)

1. **Login does triple round-trips before navigating.** `authStore.login()` runs `signInWithPassword` → then `loadUserFor()` (2 sequential queries: `profiles` + `user_roles`) → then `onAuthStateChange` fires and runs the same `loadUserFor()` again → then `goByRole()` navigates → then `/login`'s `beforeLoad` and `/admin`'s `beforeLoad` each re-query roles. That's 4–6 serial DB calls per sign-in.
2. **`/login` `beforeLoad` always hits the DB**, even for guests visiting the page, before showing the form.
3. **Home page fires 3 separate Supabase queries on mount** (`useMarkets`, `useResultsForDate`, `useLatestResultsPerMarket`) and hydrates with empty data, so the markets grid + schedule pop in late. SSR can't help because they use the browser client.
4. **Admin pages each open their own realtime channel + run queries with no `staleTime`** — every navigation refetches, every focus refetches.
5. **Heavy libs imported eagerly** in many routes: `framer-motion`, `recharts`, `embla-carousel`, full `lucide-react` barrels in admin nav, `react-day-picker`. Bundle bloat = slow first paint, especially on 4G.
6. **Image assets are JPG/PNG**, no AVIF/WebP variants, no `loading="lazy"` discipline, no `fetchpriority="high"` on the hero/LCP image.

## Plan

### A. Auth flow — remove serial round-trips (biggest win)

1. **Single source of truth.** Make `onAuthStateChange` the only place that calls `loadUserFor()`. `login()` just calls `signInWithPassword`, then awaits `hydrated` flipping or the next user update. No duplicate fetch.
2. **Parallelise profile + roles** inside `loadUserFor` (already is, keep).
3. **Combine profile + roles into one RPC** `get_me()` → `{ profile, is_admin }`. One round-trip instead of two. Add a Postgres function + `grant execute to authenticated`.
4. **Drop the roles query in `/login` `beforeLoad`.** Read `useAuthStore.user.role` from the existing in-memory state (already populated by bootstrap); only fall back to DB if `!hydrated`.
5. **Optimistic navigate-after-login.** Navigate immediately on `signInWithPassword` success; let the role-aware redirect happen in `/dashboard` or `/admin` `beforeLoad` if needed. No spinner-blocking on profile load.
6. **`/admin` guard via context, not server-fn.** Replace the per-navigation `requireAdminSSR()` call with a `useAuthStore` context check (only fall back to DB on cold SSR).

### B. Home + results — instant first paint

1. **Migrate the three home queries to `ensureQueryData` + `useSuspenseQuery`** with a route-level loader, so the markets grid and schedule render with real data on first frame (no empty-state flash).
2. **Increase `staleTime`** on `useMarkets` (already 5 min — keep), `useLatestResultsPerMarket` (set to 5 min), `useResultsForDate` (60s, realtime keeps it fresh).
3. **Coalesce realtime channels.** One shared channel for `market_results` instead of one per hook instance. Reduces websocket churn.
4. **Lazy-load below-the-fold sections** (Schedule table, Quick stats) with `React.lazy` + Suspense fallback skeletons sized to prevent CLS.

### C. Admin dashboard — kill the spinners

1. **Default `staleTime: 30_000` + `refetchOnWindowFocus: false`** in the QueryClient so tab-switching doesn't refetch.
2. **One shared admin realtime channel** per page family (results, payments, support) instead of per-query.
3. **Code-split heavy admin widgets** (`recharts` on monitoring/analytics, `react-day-picker` on date filters) so the admin shell loads fast and the chart loads only when its tab opens.
4. **Pre-fetch on hover** of admin nav links via TanStack's `preload="intent"` so clicks feel instant.

### D. Bundle + asset diet

1. **Targeted lucide imports** (`lucide-react/icons/zap`) in the admin sidebar and other icon-dense files. Saves ~80 KB gzipped.
2. **`framer-motion` → `motion`** drop-in (lighter, tree-shakable) where the project uses only `motion.div` + simple variants. Keep `framer-motion` where layout/AnimatePresence is needed.
3. **`vite-imagetools` AVIF/WebP variants** for hero + market thumbnails. Add `fetchpriority="high"` on the LCP image via `head().links`.
4. **`loading="lazy"` and `decoding="async"`** on all below-the-fold `<img>` tags.
5. **Defer `web-push` + service-worker registration** to `requestIdleCallback` so it doesn't compete with first paint.

### E. Polish (subtle, no feature changes)

1. **Skeletons that match real layout** for: home results grid, admin tables, jodi page sections. No more "Loading…" text.
2. **View Transitions API** for route changes (progressive-enhancement: Chrome/Edge get the smooth cross-fade, others fall back).
3. **Sonner toast variants tuned** — shorter durations for success, action button for retryable errors.
4. **Persistent query cache** (already wired via `useQueryCachePersistence`) — verify it's actually mounted in `__root.tsx` and add a 24h max-age so cold reloads paint with cached data instantly.

### F. Verify

- Add a one-time `browser--performance_profile` run before/after on `/`, `/login → /dashboard`, `/admin/results/declare` and report deltas (LCP, INP, JS heap, total transfer).
- Sanity-check: no new hydration warnings, no spinner stuck > 300 ms on warm caches.

## Out of scope (call out, don't do)

- Backend schema redesigns beyond the one `get_me()` RPC.
- Rewriting the realtime layer.
- Visual redesign — palette, fonts, layout untouched.

## Expected outcomes

- Sign-in click → next page rendered: **~1.2 s → ~300 ms** on a warm network.
- Home LCP: **~2.4 s → ~1.0 s** on 4G.
- Admin route navigation: feels instant after the first visit (preload-on-hover + cached data).
- Total JS shipped to a guest visitor: **~30–40 % smaller** after icon/motion/chart code-splitting.
