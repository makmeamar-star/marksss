## Goal

Delhi Markets (Gali, Disawar, Faridabad, Ghaziabad) only have a single Jodi (00–99) per day — the first digit is the "open" and the second digit is the "close". The Open and Close panas shown on the Delhi tile don't apply, so they should be removed and the Jodi displayed as the single hero number.

## Change

Edit `src/components/StarMarketTile.tsx`:

- Remove the `open` and `close` derived strings and the `NumCell` rows for them.
- Replace the 3‑column `grid-cols-3` block (Open · Jodi · Close) with a single centered Jodi cell that takes the full width.
- Make the Jodi number larger (e.g. `text-3xl sm:text-4xl`) so it reads as the headline of the card.
- Keep the "Last 3" recent‑jodi strip, the status badge, the timing line, and the Play / View Result CTA unchanged.
- The `NumCell` helper can be simplified (or left as-is and called once with `highlight`).

No other files need to change — the `MarketResult.jodi` field already exists and is what we'll render. The non‑Delhi `ResultCard` used on the rest of `/markets` and `/` keeps its existing Open · Jodi · Close layout.

## Result

```text
┌──────────────────────────────────┐
│ ★ Delhi    GALI       [Declared] │
│ 23:30 · 00:30                    │
│                                  │
│             ┌────────┐           │
│             │  Jodi  │           │
│             │   47   │           │
│             └────────┘           │
│                                  │
│ Last 3   12  84  47              │
│ ┌──────────────────────────────┐ │
│ │         Play Now  →          │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```
