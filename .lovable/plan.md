## Goal

Make the app dramatically easier to use on mobile and put **Gali, Disawar, Faridabad, Ghaziabad** front-and-center everywhere it counts. Visual feel: **Royal Gold** (black `#0d0d0d` / `#1a1a1a` + gold `#c9a84c` / `#f0d78c`).

## 1. "Star Markets" concept (the 4 highlighted markets)

A single source of truth in code:

```ts
// src/config/starMarkets.ts
export const STAR_MARKET_IDS = ["gali", "disawar", "faridabad", "ghaziabad"] as const;
```

Used by every surface below so the list stays consistent.

A new shared component **`StarMarketTile`** renders each market as a big gold-bordered card showing:

- Market name + live status pill (`OPEN` / `CLOSING in 12m` / `CLOSED`)
- Today's **Open · Jodi · Close** in large monospace digits (★ until declared)
- A 3-day mini chart strip (last 3 jodis, dimmed → bright)
- Primary CTA: **"Play now"** → jumps straight into the bet entry for the active session (or "View result" if both sessions are closed)

Skeleton state while results load; offline-cached values shown if network is down (service worker already caches results).

## 2. Surfaces that get the Star Markets

**Home (`/index`)** — new "★ Star Markets" section pinned right under the hero, before the regular markets list. 2-column grid on mobile, 4-column on desktop.

**Markets page (`/markets`)** — a sticky "★ Star Markets" strip at the top (always visible while scrolling), then the autocomplete search and the full grid below. The 4 stars are **also** highlighted inside the regular grid with a thin gold border + ★ badge so they're easy to find when searching/filtering.

**Bottom nav (new)** — a 5-slot bottom nav appears on mobile (`<md`):

```
[ Home ] [ Markets ] [ ★ Star ] [ Wallet ] [ Profile ]
```

The center "★ Star" tab is visually larger (gold pill that lifts above the bar) and lands on a dedicated `/star` route showing only the 4 markets in a single-column tall layout — biggest tap targets in the app.

## 3. "Easier" UI changes

**New `BottomNav` component** (mobile only, hidden on `/admin/*`, `/login`, `/register`):
- Fixed bottom, safe-area aware, blur backdrop, gold active indicator
- Replaces the need to dig through the header menu on phones
- Adds 60px bottom padding to page content when visible so nothing is covered

**New `StickyActionBar`** — sits just above the BottomNav on Home/Markets/Star/Result-detail pages:
- 3 wide buttons: **Deposit** (primary gold), **Play** (outline gold), **Wallet** (text)
- Auto-hides on scroll-down, reappears on scroll-up so it doesn't block content

**Simpler market card layout** — refactor `ResultCard` (or sibling component used in `/markets`) to a single horizontal row on mobile:

```
[Logo]  Market Name              123-45-678
        OPEN · closes 13:50      [Play ›]
```

Bigger 16px base font, 48px tap targets, generous 16px padding, 1px gold hairline separators instead of full borders. Same component, denser variant for desktop grid.

**Header trim** — on mobile, collapse the desktop nav links into a hamburger and keep only Logo + Wallet balance + Bell. The new bottom nav handles primary navigation.

## 4. Royal Gold theme tokens

Add to `src/styles.css` (semantic, not hardcoded):

```css
--gold: oklch(0.78 0.12 85);          /* #c9a84c */
--gold-soft: oklch(0.88 0.10 90);     /* #f0d78c */
--surface: oklch(0.16 0 0);            /* #1a1a1a */
--surface-elevated: oklch(0.20 0 0);
--gradient-gold: linear-gradient(135deg, var(--gold), var(--gold-soft));
--shadow-gold: 0 8px 32px -12px color-mix(in oklab, var(--gold) 40%, transparent);
--ring-star: 0 0 0 1.5px var(--gold);
```

Star tiles use `--gradient-gold` border + `--shadow-gold`. Status pills, active nav indicator, primary CTAs all map to `--gold`. Existing primary blue stays for non-star CTAs to keep contrast.

## 5. New route

`src/routes/star.tsx` — landing page for the bottom-nav star tab. Single column, 4 large `StarMarketTile`s stacked, each ~220px tall on mobile. Heading "★ Featured Markets". SEO title/description tuned for "Gali Disawar Faridabad Ghaziabad live result".

## Files to add

- `src/config/starMarkets.ts`
- `src/components/StarMarketTile.tsx`
- `src/components/StarMarketsSection.tsx` (the grid wrapper for Home + Markets)
- `src/components/BottomNav.tsx`
- `src/components/StickyActionBar.tsx`
- `src/routes/star.tsx`

## Files to edit

- `src/styles.css` — add Royal Gold tokens
- `src/routes/__root.tsx` — mount `<BottomNav />` (mobile only, route-aware)
- `src/routes/index.tsx` — insert `<StarMarketsSection />` under hero
- `src/routes/markets.tsx` — sticky star strip + ★ badge in grid
- `src/components/SiteHeader.tsx` — mobile trim
- `src/components/ResultCard.tsx` (or the markets-grid card) — simpler row layout + ★ badge for star markets

## Out of scope (will not touch)

- Bet entry flow, payouts, results scraping/queue logic, admin pages, auth flows, payment channels.

## Open question (non-blocking)

The "Play now" CTA on a Star Tile — when both sessions are closed for today, should it (a) deep-link to tomorrow's market detail with a "Bets open at HH:MM" notice, or (b) show "View Result" only and disable Play? I'll go with **(b) — show View Result, disable Play** unless you prefer (a).
