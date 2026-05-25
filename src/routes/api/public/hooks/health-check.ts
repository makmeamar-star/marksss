import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requireHookSecret } from "@/lib/hookAuth";

/**
 * Operational health check. Runs every 30 minutes.
 * Inserts rows into system_alerts when issues are detected:
 *  - SCRAPER_OUTAGE: no successful (OK) scrape in last 2 hours
 *  - MISSING_RESULTS: > 25% of active markets past close_time today have no result
 *  - BACKFILL_GAP: any market has fewer than 30 results in the last 90 days
 *  - HIGH_FETCH_ERROR_RATE: > 30% of last 100 scrape attempts errored
 *
 * Auto-resolves prior alerts of the same kind once conditions clear.
 *
 * NOTE: GET is left open as a liveness probe (used by Render healthCheckPath).
 * POST requires HOOK_SECRET to prevent unauthenticated alert flooding.
 */
export const Route = createFileRoute("/api/public/hooks/health-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await requireHookSecret(request);
        if (denied) return denied;
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );

        const checks: { kind: string; ok: boolean; details?: any }[] = [];
        const newAlerts: any[] = [];

        const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
        const today = nowIst.toISOString().slice(0, 10);
        const nowHHMM = nowIst.toISOString().slice(11, 16);

        // 1. SCRAPER_OUTAGE
        {
          const since = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
          const { data } = await supabase
            .from("result_scrape_log")
            .select("id")
            .eq("status", "OK")
            .gte("run_at", since)
            .limit(1);
          const ok = (data?.length ?? 0) > 0;
          checks.push({ kind: "SCRAPER_OUTAGE", ok });
          if (!ok) {
            newAlerts.push({
              source: "scraper",
              severity: "critical",
              title: "Scraper outage",
              message: "No successful scrape in the last 2 hours.",
            });
          } else {
            await autoResolve(supabase, "scraper", "Scraper outage");
          }
        }

        // 2. HIGH_FETCH_ERROR_RATE
        {
          const { data } = await supabase
            .from("result_scrape_log")
            .select("status")
            .order("run_at", { ascending: false })
            .limit(100);
          const total = data?.length ?? 0;
          const errs = (data ?? []).filter(
            (r) => r.status === "FETCH_ERROR" || r.status === "RPC_ERROR",
          ).length;
          const rate = total ? errs / total : 0;
          const ok = total < 20 || rate < 0.3;
          checks.push({ kind: "HIGH_FETCH_ERROR_RATE", ok, details: { rate, errs, total } });
          if (!ok) {
            newAlerts.push({
              source: "scraper",
              severity: "warning",
              title: "Elevated scraper error rate",
              message: `${errs}/${total} of recent scrape attempts failed (${Math.round(rate * 100)}%).`,
              context: { errs, total, rate },
            });
          } else {
            await autoResolve(supabase, "scraper", "Elevated scraper error rate");
          }
        }

        // 3. MISSING_RESULTS for today
        {
          const { data: markets } = await supabase
            .from("markets")
            .select("id, close_time, days")
            .eq("status", "ACTIVE");
          const dow = ["SUN","MON","TUE","WED","THU","FRI","SAT"][nowIst.getUTCDay()];
          const due = (markets ?? []).filter(
            (m) => (m.days as string[]).includes(dow) && (m.close_time as string) <= nowHHMM,
          );
          if (due.length > 0) {
            const { data: results } = await supabase
              .from("market_results")
              .select("market_id, close_pana")
              .eq("session_date", today)
              .in("market_id", due.map((m) => m.id));
            const declared = new Set(
              (results ?? []).filter((r) => r.close_pana).map((r) => r.market_id),
            );
            const missing = due.filter((m) => !declared.has(m.id));
            const ratio = missing.length / due.length;
            const ok = ratio < 0.25;
            checks.push({
              kind: "MISSING_RESULTS",
              ok,
              details: { due: due.length, missing: missing.length, ratio },
            });
            if (!ok) {
              newAlerts.push({
                source: "results",
                severity: "warning",
                title: "Many markets missing today's result",
                message: `${missing.length} of ${due.length} markets past close_time still have no close result.`,
                context: { missing: missing.map((m) => m.id), due: due.length },
              });
            } else {
              await autoResolve(supabase, "results", "Many markets missing today's result");
            }
          }
        }

        // 4. BACKFILL_GAP
        {
          const since = new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10);
          const { data: rows } = await supabase
            .from("market_results")
            .select("market_id")
            .gte("session_date", since);
          const counts = new Map<string, number>();
          (rows ?? []).forEach((r) =>
            counts.set(r.market_id, (counts.get(r.market_id) ?? 0) + 1),
          );
          const { data: markets } = await supabase
            .from("markets")
            .select("id")
            .eq("status", "ACTIVE");
          const sparse = (markets ?? [])
            .map((m) => ({ id: m.id, count: counts.get(m.id) ?? 0 }))
            .filter((x) => x.count < 30);
          const ok = sparse.length === 0;
          checks.push({ kind: "BACKFILL_GAP", ok, details: { sparse: sparse.length } });
          if (!ok) {
            newAlerts.push({
              source: "backfill",
              severity: "warning",
              title: "Backfill gaps detected",
              message: `${sparse.length} active markets have <30 results in the last 90 days.`,
              context: { sparse: sparse.slice(0, 30) },
            });
          } else {
            await autoResolve(supabase, "backfill", "Backfill gaps detected");
          }
        }

        // Insert new alerts (dedupe by open + same title)
        let inserted = 0;
        for (const a of newAlerts) {
          const { data: existing } = await supabase
            .from("system_alerts")
            .select("id")
            .eq("title", a.title)
            .is("resolved_at", null)
            .limit(1);
          if (existing && existing.length > 0) continue;
          await supabase.from("system_alerts").insert(a);
          inserted++;
        }

        return new Response(
          JSON.stringify({ ok: true, checks, alertsInserted: inserted }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "POST to run health-check" }), {
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});

async function autoResolve(supabase: any, source: string, title: string) {
  await supabase
    .from("system_alerts")
    .update({ resolved_at: new Date().toISOString() })
    .eq("source", source)
    .eq("title", title)
    .is("resolved_at", null);
}
