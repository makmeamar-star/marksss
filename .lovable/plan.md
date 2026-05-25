
# Deploy to Render — Migration Plan

This project currently targets **Cloudflare Workers** (`wrangler.jsonc`, Vite Cloudflare preset). Render runs **Node.js**, so we need to (1) switch the build target, (2) move runtime config to Render env vars, and (3) size the service for ~10K users. The database stays on Lovable Cloud (Supabase) — no migration there.

---

## Step 1 — Get the code onto GitHub

1. In Lovable chat: **+ menu → GitHub → Connect project** → authorize → create a new repo.
2. Clone locally: `git clone https://github.com/<you>/<repo>.git`
3. `bun install` to verify it builds on your machine.

## Step 2 — Switch the build target to Node

Edit `vite.config.ts`:

- Remove the `cloudflare` preset from the TanStack Start plugin.
- Set the target to `node-server` (TanStack Start's Node adapter).

Delete or ignore:
- `wrangler.jsonc`
- Any `import("cloudflare:*")` calls (none expected in this codebase, but grep to confirm).

Add a Render-friendly start script in `package.json`:
```json
"scripts": {
  "build": "vite build",
  "start": "node .output/server/index.mjs"
}
```

## Step 3 — Audit Worker-only code

Check these paths for Node compatibility (most already use safe APIs):
- `src/routes/api/public/hooks/*.ts` — uses `web-push` (Node-compatible ✓) and `crypto` (Node-compatible ✓).
- `src/integrations/supabase/client.server.ts` — Supabase JS works on Node ✓.
- `src/lib/scraper/*.server.ts` — uses `fetch`, available natively in Node 20+ ✓.

No code changes expected, but the build will surface anything Worker-specific.

## Step 4 — Create the Render service

In Render dashboard:

1. **New → Web Service** → connect the GitHub repo.
2. **Runtime:** Node
3. **Build command:** `bun install && bun run build`
   *(Add a `BUN_VERSION` env var = `1.1.x` so Render uses Bun.)*
4. **Start command:** `node .output/server/index.mjs`
5. **Plan:** **Standard** ($25/mo, 2 GB RAM, 1 CPU) minimum — `Starter` will OOM under real load.
6. **Region:** pick closest to your users (e.g. Singapore for India traffic).
7. **Health check path:** `/api/public/hooks/health-check`

## Step 5 — Configure environment variables on Render

Copy these from Lovable into Render → **Environment**:

**Public (used at build time too):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

**Server-only secrets:**
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` *(get from Lovable Cloud → Database → API)*
- `LAFXNGA_ADMIN_PASSWORD`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `PUSH_DISPATCH_SECRET`

## Step 6 — Scale for ~10K users

10K registered users ≠ 10K concurrent. Plan for ~500–1000 concurrent at peak.

- **Render web service:** Standard plan + **Autoscaling 2–4 instances** (Render dashboard → Scaling). Trigger on 70% CPU.
- **Database (the real bottleneck):** in Lovable Cloud → Overview → Advanced settings, bump the Postgres instance from Nano → **Small or Medium**. Monitor with `supabase--db_health`.
- **Connection pooling:** the Supabase JS client uses HTTPS (PostgREST), not raw Postgres connections, so no PgBouncer config needed.
- **Static assets:** Render auto-serves `dist/client` with gzip. For images, add a CDN (Cloudflare in front of Render) if traffic spikes.
- **Realtime / cron:** the `/api/public/hooks/*` endpoints (auto-declare, scrape, alert-missing-results, dispatch-push) need to be triggered on a schedule. Either:
  - Render **Cron Jobs** (separate service, ~$1/mo each), or
  - Keep them triggered by Supabase `pg_cron` (already configured in migrations).

## Step 7 — Custom domain + SSL

1. Render → service → **Settings → Custom Domains** → add your domain.
2. Add the CNAME at your registrar as Render instructs.
3. SSL is auto-provisioned (Let's Encrypt).

## Step 8 — Post-deploy checks

- Hit `/` and `/admin` — confirm SSR renders.
- Hit `/api/public/hooks/health-check` — should return 200.
- Log in as admin using `LAFXNGA_ADMIN_PASSWORD`.
- Trigger a test push notification — confirms VAPID keys work.
- Watch Render **Metrics** tab for CPU/memory during first hour.

---

## Cost estimate (monthly)

| Item | Cost |
|---|---|
| Render Standard web service (2 instances) | ~$50 |
| Render Cron jobs (×3) | ~$3 |
| Lovable Cloud Postgres (Small) | ~$25 |
| **Total** | **~$80/mo** |

For comparison: staying on Lovable Publish + bumping the DB to Small = ~$25/mo and zero migration work.

---

## What I'll do when you switch to build mode

1. Edit `vite.config.ts` to use the `node-server` preset.
2. Add the `start` script and `BUN_VERSION` to `package.json`.
3. Create a `render.yaml` blueprint so you can one-click deploy.
4. Add a brief `DEPLOY.md` with the env-var checklist.
5. Leave `wrangler.jsonc` in place (harmless) unless you want it deleted.

I will **not** touch database migrations, auth, or business logic.
