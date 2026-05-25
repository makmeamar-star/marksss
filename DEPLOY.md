# Deploying to Render

This app is built on TanStack Start and is configured for **Cloudflare Workers** inside Lovable. To deploy on **Render** (Node runtime) you need to make a few local changes after cloning from GitHub. The Lovable preview keeps working as-is — these changes only apply to your Render fork.

> **Tip:** If you don't need Render specifically, just click **Publish** in Lovable. It deploys to Cloudflare's edge network and easily handles 10K users.

---

## 1. Get the code

```bash
# In Lovable: + menu → GitHub → Connect project
git clone https://github.com/<you>/<repo>.git
cd <repo>
bun install
```

## 2. Switch the build target to Node

Replace `vite.config.ts` with:

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      target: "node-server",
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
```

Remove Cloudflare-only files:

```bash
rm wrangler.jsonc
bun remove @cloudflare/vite-plugin @lovable.dev/vite-tanstack-config
```

Add a `start` script to `package.json`:

```json
"scripts": {
  "build": "vite build",
  "start": "node .output/server/index.mjs"
}
```

Verify locally:

```bash
bun run build
bun run start   # should boot on http://localhost:3000
```

## 3. Create the Render service

In the Render dashboard:

1. **New → Blueprint** → point at your repo. It will read `render.yaml` and create the service automatically.
2. Or **New → Web Service** manually with:
   - Build: `bun install && bun run build`
   - Start: `node .output/server/index.mjs`
   - Plan: **Standard** ($25/mo, 2 GB RAM) minimum
   - Health check: `/api/public/hooks/health-check`

## 4. Fill in environment variables on Render

All values come from Lovable. Open **Cloud → Database → API** for the Supabase ones, and **Cloud → Secrets** for the rest.

**Public (build-time):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

**Server-only:**
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LAFXNGA_ADMIN_PASSWORD`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `PUSH_DISPATCH_SECRET`

## 5. Scale for ~10K users

10K registered users ≠ 10K concurrent. Plan for ~500–1000 concurrent at peak.

| Layer | Setting |
|---|---|
| Render web service | Standard plan, autoscale 2 → 4 instances at 70% CPU (already in `render.yaml`) |
| Postgres (Lovable Cloud) | Cloud → Overview → Advanced settings → bump from Nano to **Small or Medium**. This is the real bottleneck. |
| Static assets | Render serves `dist/client` with gzip. Put Cloudflare in front for free CDN if needed. |
| Cron jobs | Already handled by Supabase `pg_cron` calling `/api/public/hooks/*`. Nothing to add on Render. |

## 6. Custom domain

Render → service → **Settings → Custom Domains** → add domain → set the CNAME at your registrar. SSL is automatic.

## 7. Post-deploy checks

- `GET /` and `/admin` render
- `GET /api/public/hooks/health-check` returns 200
- Admin login works with `LAFXNGA_ADMIN_PASSWORD`
- A test push notification goes through (confirms VAPID keys)

---

## Estimated cost

| Item | Monthly |
|---|---|
| Render Standard (2 instances) | ~$50 |
| Lovable Cloud Postgres (Small) | ~$25 |
| **Total** | **~$75** |

Staying on Lovable Publish costs **~$25/mo** for the same throughput and requires zero migration. Only move to Render if you specifically need Node-runtime libraries or your team already operates on Render.
