import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Authenticated wrapper around the /api/public/hooks/scrape-results endpoint.
 * Any signed-in user can call this (it is rate-limited client-side and the
 * underlying scrape is idempotent). We forward the request server-side with
 * the HOOK_SECRET so the hook itself can stay locked down to trusted callers.
 */
export const triggerFreshScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const secret = process.env.HOOK_SECRET;
    if (!secret) return { ok: false, error: "HOOK_SECRET not configured" };

    // Build a base URL for the hook. Prefer explicit env, fallback to local.
    const base =
      process.env.PUBLIC_SITE_URL ||
      process.env.VITE_PUBLIC_SITE_URL ||
      "http://localhost:3000";
    try {
      const res = await fetch(`${base}/api/public/hooks/scrape-results`, {
        method: "POST",
        headers: { "x-hook-secret": secret, "Content-Type": "application/json" },
        body: "{}",
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: String((e as Error).message ?? e) };
    }
  });
