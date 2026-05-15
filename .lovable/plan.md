## Goals

1. Surface 15 hand-picked markets up front; tuck the other 102 behind a "Show all markets" expander on the homepage, /markets, and the ticker.
2. Squeeze obvious perf wins (route-level caching, prefetch, deferred ticker, image hints).
3. Convert the published site to a real PWA so you can paste the URL into pwabuilder.com and download a signed APK.

---

## 1. Top 15 markets

Add a single source of truth at `src/lib/topMarkets.ts`:

```ts
export const TOP_MARKET_IDS = [
  "kalyan", "kalyan_night", "milan_day", "milan_night",
  "rajdhani_day", "rajdhani_night", "main_bazar", "main_mumbai",
  "time_bazar", "sridevi", "sridevi_night",
  "madhur_day", "madhur_night", "kalyan_morning", "super_kalyan",
] as const;

export function splitTopMarkets<T extends { id: string }>(all: T[]) {
  const set = new Set<string>(TOP_MARKET_IDS);
  const top = TOP_MARKET_IDS
    .map(id => all.find(m => m.id === id))
    .filter(Boolean) as T[];
  const rest = all.filter(m => !set.has(m.id));
  return { top, rest };
}
```

Apply in three places:

- **`src/routes/markets.tsx`** — render `top` in the existing grid; render `rest` inside a shadcn `Collapsible` ("Show all 102 markets" / "Hide"). Default closed. Persist open state in `localStorage` so power users don't keep re-opening it.
- **`src/routes/index.tsx`** — same split for the "Today's Live Results" grid AND the schedule table. Hero counters keep showing totals across all 117.
- **`src/components/ResultsTicker.tsx`** — only loop over `top`. Ticker stays snappy and readable.

Charts page already uses a `<Select>` so all 117 are still reachable; no change needed there beyond reordering top-15 to the top of the dropdown.

---

## 2. Performance pass

Cheap wins, no architectural changes:

- **Cache markets aggressively.** `markets` rarely change. In `useMarkets`, set `staleTime: 5 * 60_000` and `gcTime: 30 * 60_000`. Today's results stay at the current 30s refetch.
- **Prefetch `/markets` and `/bet/$marketId`** on link hover via `<Link preload="intent">` in `SiteHeader` and the homepage cards. TanStack Router already supports this; the hook is already importable.
- **Defer the ticker.** Wrap `<ResultsTicker />` in `React.lazy` + `Suspense` with a `h-9` skeleton matching its current placeholder, so it doesn't block hero paint.
- **Memoize the schedule table.** `useMemo` over `markets` to avoid re-rendering 117 rows on every state tick.
- **Image hints.** Add `loading="lazy" decoding="async"` to non-LCP imagery (rangoli divider, footer logos). Add `<link rel="preconnect" href="https://kpahmkjutkfyhydfgffh.supabase.co">` in `__root.tsx` head.
- **DB index sanity.** Already have `markets_pkey`; add a covering index on `market_results(market_id, session_date desc)` if it isn't there (migration step). Speeds the 30-second refetch noticeably.

Not in scope: refactoring data fetching, image-format conversion, or font swaps. We'll measure before going deeper.

---

## 3. PWA + APK

Honoring the warning: the service worker is **disabled in dev/preview** and only activates on `golden-play-pro.lovable.app` and your custom domains.

Steps:

1. **Install `vite-plugin-pwa`** and wire it into `vite.config.ts` with:
   - `registerType: "autoUpdate"`
   - `devOptions: { enabled: false }`
   - `workbox.navigateFallbackDenylist: [/^\/api/, /^\/~oauth/]`
   - `workbox.runtimeCaching`: `NetworkFirst` for HTML navigations (3s timeout), `StaleWhileRevalidate` for `/assets/*` and Supabase REST GETs.
2. **Add `public/manifest.webmanifest`** with name "SattaKing Pro", short_name "SattaKing", `display: "standalone"`, theme/background colors from the design tokens, and icon set (192/512 maskable + monochrome). I'll generate the icons with imagegen and drop them in `public/icons/`.
3. **Guard registration** in `src/main.tsx` (or wherever the client entry is) so it never registers inside iframes or on `*.lovableproject.com` / `id-preview--*` hosts.
4. **APK delivery** — once published, you paste `https://golden-play-pro.lovable.app` (or your custom domain) into https://pwabuilder.com → Android → Download. PWABuilder produces a signed TWA `.apk`/`.aab` you can sideload or upload to Play Store. The site needs to score green on PWABuilder; the manifest + SW above will do that.

Caveats called out up front:
- PWA install prompt and offline cache only work on the published URL, never in the editor preview.
- Manifest fields (`start_url`, `display`) are pinned at install time on iOS/Android. If we change them later, only fresh installs see the change.
- The APK is a TWA wrapper, not a native app — it's the website running in a Chrome surface. That's the standard, sanctioned way to ship a PWA to Play Store.

---

## Files touched

```text
src/lib/topMarkets.ts                    (new)
src/routes/markets.tsx                   (split + Collapsible)
src/routes/index.tsx                     (split + Collapsible + memo)
src/routes/charts.tsx                    (reorder dropdown)
src/components/ResultsTicker.tsx         (top-15 only, lazy-load)
src/hooks/useGameData.ts                 (staleTime/gcTime tune)
src/routes/__root.tsx                    (preconnect, lazy ticker scaffold)
src/main.tsx                             (PWA registration guard)
vite.config.ts                           (vite-plugin-pwa)
public/manifest.webmanifest              (new)
public/icons/*.png                       (new, generated)
supabase/migrations/<ts>_market_results_idx.sql  (covering index)
```

## What you do after I ship

1. Click **Update** in the Publish dialog to deploy the SW to `.lovable.app`.
2. Open the published URL on Android Chrome → confirm "Install app" appears.
3. Go to https://pwabuilder.com, paste the URL, click **Package for Stores → Android**, download the APK.
