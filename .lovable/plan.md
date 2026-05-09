## Goal
Avoid the empty/black look on the Results page (and home page result grid) when nothing has been declared yet today by falling back to each market's most recent previously declared result.

## Behavior
For every market card on `/` and `/results` (when the selected date is today):
- If today's result is `DECLARED` → show as today (current behavior).
- Else → show that market's last declared result from a previous day, dimmed/labelled so users know it's old. The status badge still reflects today (OPEN / CLOSED / awaiting), and the countdown for today's reveal still shows.
- If there is truly no prior result either → keep the existing `***` placeholder.

When the user picks a past date in `/results`, behavior is unchanged (show that exact date only — no fallback).

## UI changes
`src/components/ResultCard.tsx`
- Add optional `previousResult?: MarketResult` and `showPreviousFallback?: boolean` props.
- When today's `result` is missing/not declared and `previousResult` exists, render the previous open-jodi-close numbers in a muted color (no gold glow) with a small `Prev · {DD MMM}` chip under the numbers. Keep today's status badge and countdown as-is.

## Data changes
`src/hooks/useGameData.ts`
- Add `useLatestResultsPerMarket()` — one query that pulls the most recent declared result per market (e.g. last 14 days of `market_results` where `status = 'DECLARED'`, then reduce to latest per `market_id` client-side). Realtime invalidation already wired for `market_results`.

## Page wiring
`src/routes/index.tsx` and `src/routes/results.tsx`
- Use `useLatestResultsPerMarket()` and pass `previousResult={latest[m.id]}` + `showPreviousFallback` to each `ResultCard`. On `/results`, only enable the fallback when `date === today`.

## Out of scope
- No DB / migration changes.
- No changes to the 14-day history table or admin pages.
- No business-logic changes (settlements, auto-declare, etc.).