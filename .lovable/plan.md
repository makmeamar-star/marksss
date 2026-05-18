## Goal

On phones, market result cards take the full screen width and feel huge — only ~1 card visible at a time. Make them compact and fit 2 per row on mobile (3+ on larger screens stays the same).

## Changes

### 1. `src/components/ResultCard.tsx` — make the card compact
- Reduce padding: `p-3` → `p-2.5`
- Title `text-base` → `text-sm`, subtitle line stays `text-[10px]`
- Result row: `text-base md:text-lg` → `text-sm md:text-base`, reduce `gap-2` → `gap-1.5`, `min-h-[44px]` → `min-h-[36px]`
- Tighten vertical rhythm: `my-2` → `my-1.5`, `mt-2 pt-2` footer → `mt-1.5 pt-1.5`
- Keep DECLARED/OPEN badges and the alert bell as-is (already tiny)

### 2. `src/routes/index.tsx` — 2 columns on mobile
- Live Results grid: `grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` → `grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- "Bet Now" button on /markets page rows: shrink to `h-7 text-[11px]` so two side-by-side cards aren't dominated by the CTA

### 3. `src/routes/markets.tsx` — 2 columns on mobile
- Both grids (filtered flat grid + top grid + collapsible rest grid):
  `grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
  → `grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Same Bet Now button shrink as above

### 4. `src/components/StarMarketTile.tsx` — verify it fits
Star Markets section already uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. On mobile it stays 1 col (the scrollable variant on /markets is fine). Out of scope unless visually broken after the rest of the changes.

## Out of scope

- Schedule table (already narrow rows, scrolls horizontally)
- Stat / QuickStat tiles
- Layout breakpoints above `sm` (≥640px)

## Notes

Pure CSS/Tailwind class changes — no logic, data, or business changes. Hydration warnings already in the runtime errors are pre-existing and not caused by these edits.
