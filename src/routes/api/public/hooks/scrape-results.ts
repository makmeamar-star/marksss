import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fetchAllForMarket, mapToRealDpbossDate, type SourceName } from "@/lib/scraper/index.server";

/**
 * Live scrape hook. Iterates every enabled market_source_map row, fetches
 * today's panel from the source, and if a pana is published, calls
 * system_auto_declare to settle. Logs every attempt to result_scrape_log.
 *
 * Safe to invoke every 2 minutes via pg_cron.
 */
export const Route = createFileRoute("/api/public/hooks/scrape-results")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // IST today
        const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
        const today = nowIst.toISOString().slice(0, 10);

        const { data: maps, error: mapErr } = await supabase
          .from("market_source_map")
          .select("market_id, source, slug")
          .eq("enabled", true);
        if (mapErr) {
          return json({ ok: false, error: mapErr.message }, 500);
        }

        const summary: any[] = [];

        for (const m of maps ?? []) {
          for (const session of ["OPEN", "CLOSE"] as const) {
            try {
              const days = await fetchAllForMarket(m.source as SourceName, m.slug);
              const todayRow = days.find((d) => d.date === today);
              const pana = session === "OPEN" ? todayRow?.openPana : todayRow?.closePana;

              if (!pana) {
                await supabase.from("result_scrape_log").insert({
                  market_id: m.market_id,
                  session_date: today,
                  session,
                  source: m.source,
                  status: "NOT_YET",
                });
                continue;
              }

              // Validate via RPC by attempting system_auto_declare
              const { data: rpc, error: rpcErr } = await supabase.rpc("system_auto_declare", {
                _market_id: m.market_id,
                _session_date: today,
                _session: session,
                _pana: pana,
              });

              if (rpcErr) {
                await supabase.from("result_scrape_log").insert({
                  market_id: m.market_id,
                  session_date: today,
                  session,
                  source: m.source,
                  status: "RPC_ERROR",
                  pana,
                  error: rpcErr.message,
                });
                summary.push({ market: m.market_id, session, error: rpcErr.message });
              } else {
                const status = (rpc as any)?.skipped ? "SKIPPED_DECLARED" : "OK";
                await supabase.from("result_scrape_log").insert({
                  market_id: m.market_id,
                  session_date: today,
                  session,
                  source: m.source,
                  status,
                  pana,
                });
                summary.push({ market: m.market_id, session, pana, status });
              }
            } catch (e: any) {
              await supabase.from("result_scrape_log").insert({
                market_id: m.market_id,
                session_date: today,
                session,
                source: m.source,
                status: "FETCH_ERROR",
                error: String(e?.message ?? e),
              });
            }
          }
        }

        return json({ ok: true, count: summary.length, summary });
      },
      GET: async () => json({ ok: true, hint: "POST to run scraper" }),
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
