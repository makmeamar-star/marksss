## Diagnosis

End-to-end check turned up **one real bug** plus a couple of false alarms:

### Real bug: realtime subscription crash on homepage

Console (from the user's preview) shows:

```
Error: cannot add `postgres_changes` callbacks for realtime:results:2026-05-09 after `subscribe()`.
  at useGameData.ts (useResultsForDate effect)
```

Cause: `useResultsForDate` and `useMyBets` build the channel with a fixed topic (`results:${date}`, `bets:${userId}`). In React Strict Mode (dev) and on fast remounts, `useEffect` mounts → cleans up → mounts again. supabase-js v2 keeps channels keyed by topic; the second mount gets back the *already-subscribed* channel and `.on(...)` throws because callbacks can't be added after `subscribe()`.

It doesn't blank the page (data still loads — `markets` and `market_results` requests are 200), but it spams the error log and breaks realtime invalidation for that date/user until the next full reload.

### Verified working
- `GET /markets` → 200 with all 8 markets
- `GET /market_results?session_date=eq.2026-05-09` → 200 (empty, expected)
- Routes resolve, `__root` renders, no SSR 500, no runtime error boundary tripped
- Previous-results fallback hook (`useLatestResultsPerMarket`) executes without error

### False alarms
- `postMessage` warnings from `cdn.gpteng.co` — Lovable editor bridge, not your app
- The remote-browser test session showed a 502 from vite for `useCanGoBack.js` — that's the headless test sandbox, not the user's actual preview (their network log shows the page loading data fine)

---

## Fix

### 1. `src/hooks/useGameData.ts` — make channel topics unique per mount

Both `useResultsForDate` and `useMyBets` use a fixed topic. Change to a unique-per-mount topic so Strict Mode double-mount and route remounts can't collide.

```ts
// useResultsForDate
useEffect(() => {
  const topic = `results:${date}:${crypto.randomUUID()}`;
  const ch = supabase
    .channel(topic)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "market_results",
        filter: `session_date=eq.${date}` },
      () => qc.invalidateQueries({ queryKey: ["results", date] }),
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [date, qc]);

// useMyBets — same pattern with `bets:${userId}:${crypto.randomUUID()}`
```

This is the standard supabase-js v2 fix for the "callbacks after subscribe" error in React Strict Mode.

### 2. Verification (no code changes)

After the patch:
- Reload `/` and `/results` → confirm the realtime error is gone from the console
- Confirm `markets` and `market_results` still fetch
- Confirm the previous-results fallback skeleton/retry behavior from the last task still works
- Spot-check `/admin/results/automation-runs` (uses `useMyBets` indirectly via authed routes) for the same error class

### Out of scope
- The hero section appearing dim on a 430px viewport is intentional gradient styling, not a bug
- No DB / RLS / migration changes
- No changes to admin auto-declare flow, settlement logic, or auth

---

## Files touched
- `src/hooks/useGameData.ts` — two effect topics get a uuid suffix (~4 lines changed total)