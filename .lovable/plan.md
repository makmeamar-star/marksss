# SattaKing Pro — Next Version ("v2 Advance") Plan

North star stays the same: **acquire more users, keep them coming back daily, and convert them into bettors**. v2 layers intelligence, virality, and trust on top of what already ships.

---

## 1. Goals for v2

1. **Organic growth** — rank for "kalyan result today", "gali disawar chart", etc., and turn every result into a shareable artifact.
2. **Daily retention** — give every user a reason to open the app at result time, every single day.
3. **Smarter product** — use the data we already collect (results, bets, scrapes, PWA funnel) to power predictions, personalization, and risk controls.
4. **Operator trust** — make the site feel safer, faster, and more "official" than the dpboss-style competitors.

---

## 2. Workstreams

### A. Acquisition & SEO (highest ROI)

1. **Per-market public pages** at `/markets/$marketId` and `/charts/$marketId`
   - Today's result, last 30/60/90-day panel + jodi chart, schedule, payout calculator, FAQ schema.
   - Per-route `head()` with unique title/description/canonical/og — derived from loader data.
2. **Generated branded OG images** (1200×630) per market + per result day, stored in Supabase Storage, referenced from `head()`.
3. **Programmatic content**: weekly/monthly "Kalyan result history — May 2026" pages auto-generated from results data.
4. **Sitemap upgrade**: include every market + every chart month; ping search engines on declare.
5. **JSON-LD**: `BreadcrumbList`, `FAQPage`, `Dataset` for chart pages.
6. **Speed**: fix remaining hydration mismatches (`Stat`, `StarMarketsSection`), lazy-load `framer-motion`, drop double polling where realtime is already on.

### B. Sharing & virality

7. **WhatsApp/Telegram share** on every `ResultCard`, per-market page, and post-win screen. Pre-filled text + short link.
8. **Auto-generated "result card" image** (canvas/satori on the server) users can download/share — branded, watermarked.
9. **Referral loop surfaced publicly**: homepage band + post-bet success + post-win celebration. Track k-factor.
10. **PWA install nudge v2**: after 2nd visit OR after first win; A/B copy via the existing PWA funnel table.

### C. Retention & engagement

11. **Daily login streak** (`user_streaks` table + RPC), with bonus credit at 3/7/14/30 days.
12. **Push notifications**: result-declared pushes per subscribed market (infra exists in `push.functions.ts` — finish UI + opt-in flow on each market page).
13. **In-app result alerts** with sound (component exists — promote it).
14. **Public leaderboard preview** on homepage (anonymized top winners today/week).
15. **Achievements** — wire the existing `/achievements` route to real events (first bet, 7-day streak, first jodi win, etc.).
16. **Hindi language toggle** (full i18n, not partial).

### D. Smart features (data we already have)

17. **Jodi/pana frequency & "hot/cold" insights** per market, computed from `market_results` — surfaced on chart pages and as a "Today's picks" widget (clearly labelled as statistical, not a prediction).
18. **Personal stats dashboard upgrade**: win rate by market, best bet type, monthly P&L chart.
19. **Smart bet suggestions** based on user's history + market hot numbers (opt-in).
20. **AI result-explainer**: short auto-written summary per declared result ("Kalyan opened 240 → 6, closed 123 → 6, jodi 66") using Lovable AI for natural-language phrasing in Hindi/English.

### E. Trust, safety, compliance

21. **"Last updated" + source badge** on every result (use `result_scrape_log`).
22. **Public `/status` page** showing scraper health, uptime, last declare per market.
23. **Responsible-gaming upgrades**: deposit/loss/session limits surfaced in onboarding, cooling-off period, self-exclusion.
24. **Stronger age-gate** that blocks first paint (required for ad networks).
25. **Run security scanner**, fix RLS gaps, rotate keys before any paid campaign.

### F. Admin & ops v2

26. **Unified ops console**: one screen with scraper health, missing results, pending payouts, today's P&L, live PWA funnel (already built).
27. **Risk dashboard**: heavy-exposure jodi/pana per market before close, so admin can suspend if needed.
28. **Automation: auto-declare with confidence threshold** (two-source confirm exists — extend to auto-publish when confidence is high, queue for review otherwise).
29. **Broadcast composer** with templates + scheduling (push + in-app + WhatsApp deep link).
30. **Audit log search/filter** + CSV export.

### G. Monetization & wallet

31. **UPI auto-verify via UTR** (`utr-callback` exists — finish the loop with auto-credit + receipt).
32. **Withdrawal SLA tracker** visible to user ("Avg 12 min today") — trust signal.
33. **Promo/cashback engine** behind a single `promotions` table (component exists, no engine).
34. **Refer-and-earn tiers**: bronze/silver/gold based on referred bettor volume.

---

## 3. Recommended sequencing (4 sprints)

### Sprint 1 — Foundation & SEO (1 week)
- Hydration fixes (Stat, StarMarketsSection, any `Date.now()` in render).
- Per-route SEO + branded OG image + sitemap upgrade + JSON-LD.
- Per-market public page (`/markets/$marketId`) with chart + share buttons.
- "Last updated" + source badge on results.

### Sprint 2 — Virality & retention loop (1 week)
- WhatsApp share everywhere + auto-generated result-card image.
- PWA install nudge v2 (A/B via funnel table already live).
- Daily streak + 3/7/14/30 bonus.
- Public leaderboard preview on homepage.
- Push notifications opt-in on each market page.

### Sprint 3 — Smart layer (1–2 weeks)
- Hot/cold jodi & pana stats per market.
- Personal stats dashboard upgrade.
- AI result-explainer (Lovable AI Gateway, Gemini Flash).
- Smart bet suggestions (opt-in).
- Hindi full i18n.

### Sprint 4 — Trust, ops, monetization (1–2 weeks)
- Public `/status` + risk dashboard + auto-declare with confidence.
- Responsible-gaming controls + stronger age-gate + security scan.
- UPI auto-credit finish + withdrawal SLA tracker.
- Promo/cashback engine + referral tiers.

---

## 4. Technical notes

- **Hydration**: any "now"-derived value (badges, isOpen, isStale, stat counts) must render a server-safe default and update inside `useEffect`. Audit `Stat`, `StarMarketsSection`, ticker, countdowns.
- **OG images**: server route `/api/og/market/$id.png` using `satori` + `resvg-wasm` (Worker-safe), cached in Storage by `(marketId, sessionDate)`.
- **Hot/cold**: nightly server function aggregates last 30/90/365 days into a `market_number_stats` table; chart pages read from that, not raw results.
- **AI explainer**: triggered from the existing declare flow; writes to `market_results.summary_en` / `summary_hi`. Use Gemini 2.5 Flash via Lovable AI Gateway — no key needed.
- **Streaks**: `user_streaks (user_id, current, longest, last_login_date)` + RPC `record_daily_login` called from the `_authenticated` root loader.
- **Push**: VAPID infra already exists; just wire per-market opt-in UI + dispatch on declare.
- **Realtime vs polling**: prefer realtime + on-focus refetch; remove 30–60s intervals where realtime is subscribed.
- **All server-side logic** stays in `createServerFn` (TanStack Start) — no Supabase Edge Functions for new work.

---

## 5. What I want to confirm before I start building

1. Which sprint do you want first — **SEO foundation** (slowest payoff, biggest long-term) or **virality/retention** (fastest visible impact)?
2. Are public per-market SEO pages OK in your target geos compliance-wise?
3. WhatsApp share OK, or Telegram-only?
4. AI result-explainer in **Hindi + English** by default, or English only initially?

Once you pick, I'll start Sprint 1 immediately.
