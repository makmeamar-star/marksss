
# SattaKing Pro — Visual Prototype Plan

You chose **"Prototype only here"** — so this Lovable project will be a **frontend-only UI prototype** showcasing every screen, the dark-gold luxury theme, animations, and interaction flows. All data (markets, results, bets, users, transactions) will be **mocked in-memory / localStorage**. No real auth, no real database, no real payments, no WebSocket server.

You (or another tool) then port the design + component code to your Express + Prisma + Postgres + Redis + Socket.io backend on Render.

## What this prototype will deliver

- Pixel-faithful UI for all 10 user pages and 8 admin pages from your spec
- Dark + gold luxury theme (Rajdhani / Inter / JetBrains Mono, particle hero, glassmorphism, neon glow, slot-machine result reveal)
- Mocked betting flow that updates a fake wallet in localStorage
- Mocked admin "declare result" that runs the real settlement logic against fake bets so the algorithm is reviewable
- Pana-chart validation using the exact digit→pana table from your spec
- Fully responsive (mobile bottom nav, bet-slip drawer, swipeable tabs)
- Framer Motion animations, Recharts analytics, sonner toasts

## What this prototype will NOT do

- No real users, login persistence, or password hashing — login is a mock that picks a role
- No real money, UPI, bank transfers, or Stripe
- No real-time across devices — "live updates" simulated with timers + Zustand subscriptions in one browser
- No SMS/OTP/email
- No production security (rate limits, CSRF, JWT) — these belong in your Express backend
- Will not run on Render as-is. The Express/Prisma/Redis/Socket.io stack must be built separately.

## Tech inside Lovable

Per Lovable's stack (deviates from your spec; this is a UI prototype):
- React 19 + TypeScript + Vite + TanStack Start (file-based routing)
- Tailwind v4 + shadcn/ui (semantic tokens in `src/styles.css`)
- Framer Motion, Recharts, sonner, date-fns, Zustand, TanStack Query
- Mock data layer: Zustand stores + localStorage persistence + setInterval-based "scheduler"
- Settlement engine written in pure TypeScript (portable straight to your Node backend)

## Phased delivery

You said "Full build, phased." I'll implement Phase 1 now. After you review, say "next phase" to continue.

### Phase 1 — Foundation + public surface (this iteration)
1. Design system: dark/gold tokens, fonts, glow + glass utility classes
2. Mock data layer: markets seed (8 markets from your spec), pana chart, sessions, bets, users, transactions in Zustand + localStorage
3. Pure-TS settlement engine + pana validator (reusable in your Node backend)
4. Routes: `/` landing (hero + particles + live result grid + ticker + schedule + stats + footer), `/results`, `/charts` (pana / jodi / open-close)
5. Shared layout: header with animated ticker, footer
6. ResultCard, CountdownTimer, NumberGrid components with slot-machine reveal animation

### Phase 2 — Auth + user dashboard + betting
- `/login`, `/register` (mock — pick role, persist in localStorage)
- `_authenticated` layout with sidebar + mobile bottom nav
- `/dashboard`, `/markets`, `/bet/:marketId` (all bet types: Single / Jodi / Pana / Half / Full Sangam, multi-bet slip)
- `/my-bets` with filters and summary cards

### Phase 3 — Wallet + profile + notifications
- `/wallet` (deposit form with UPI/QR mock, withdraw form, transactions table)
- `/profile` (edit, referral, security, notification toggles)
- Notifications panel + toast system, win celebration overlay

### Phase 4 — Admin panel
- `/admin` separate layout, role-gated (mock)
- Admin dashboard (KPIs + Recharts), Markets CRUD, **Result management with settlement preview + declare flow**, Users, Bets, Deposits/Withdrawals approval, Broadcasts, Reports

### Phase 5 — Polish + simulated realtime + handoff doc
- Simulated cron (open/close markets on schedule), simulated WebSocket (pub/sub via Zustand)
- Loading skeletons, empty states, error boundaries, 404
- `HANDOFF.md` mapping every mock to the Express/Prisma endpoint it should become, plus the Prisma schema and settlement engine ready to copy into your Render backend

## Technical details

- Routes live in `src/routes/` (TanStack file-based). Each major section is its own route file (no hash-anchor SPA) so SEO/SSR work after handoff.
- Settlement engine in `src/lib/settlement.ts` — same function signature as your spec's algorithm; pure functions, easy to drop into Express.
- Pana chart in `src/lib/panaChart.ts` with the exact 10×10 table from your spec.
- Mock stores under `src/stores/` (auth, markets, bets, wallet, notifications) with `persist` middleware.
- Color tokens added to `src/styles.css` as oklch CSS variables mapped to your hex palette (#0a0a0f, #f59e0b, etc.) and exposed via Tailwind utilities (`bg-background`, `text-primary`, `border-gold-glow`, etc.). No raw hex in components.

## Reminder on legal exposure

You accepted responsibility, so I'll build it — but flagging once for the record: deploying a real-money Matka product to UK users without a UKGC licence is a criminal offence under the Gambling Act 2005, and Matka is illegal in most Indian states. A UI prototype is fine; going live with real money is not, until you have the licence and a regulated payment processor.

Approve this plan and I'll start Phase 1.
