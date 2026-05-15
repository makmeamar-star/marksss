import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fetchAllForMarket, mapToRealDpbossDate, type SourceName } from "@/lib/scraper/index.server";

/**
 * Queue processor for failed scrape attempts.
 * Reads PENDING rows from scrape_retry_queue whose next_attempt_at has elapsed,
 * retries the fetch, and records the outcome (success / reschedule / give up).
 *
 * Scheduled every 2 minutes via pg_cron.
 */
const BATCH_SIZE = 25;

export const Route = createFileRoute("/api/public/hooks/process-scrape-queue")({
  server: {
    handlers: {
      POST: async () => {
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: due, error: dueErr } = await supabase
          .from("scrape_retry_queue")
          .select("id, market_id, session_date, session, source, slug, attempts, max_attempts")
          .eq("status", "PENDING")
          .lte("next_attempt_at", new Date().toISOString())
          .order("next_attempt_at", { ascending: true })
          .limit(BATCH_SIZE);

        if (dueErr) return json({ ok: false, error: dueErr.message }, 500);

        const results: any[] = [];

        for (const row of due ?? []) {
          try {
            const days = await fetchAllForMarket(row.source as SourceName, row.slug);
            const lookupDate = mapToRealDpbossDate(row.session_date);
            const dayRow = days.find((d) => d.date === lookupDate);
            const pana = row.session === "OPEN" ? dayRow?.openPana : dayRow?.closePana;

            if (!pana) {
              // Fetch worked but result still not published.
              // Treat as failure so backoff schedules the next try.
              await supabase.rpc("update_scrape_retry_outcome", {
                _id: row.id,
                _success: false,
                _error: "result not yet published by source",
              });
              results.push({ id: row.id, market: row.market_id, session: row.session, status: "NOT_YET" });
              continue;
            }

            const { error: rpcErr } = await supabase.rpc(
              "record_observation_and_maybe_declare",
              {
                _market_id: row.market_id,
                _session_date: row.session_date,
                _session: row.session,
                _source: row.source,
                _pana: pana,
              },
            );

            if (rpcErr) {
              await supabase.rpc("update_scrape_retry_outcome", {
                _id: row.id,
                _success: false,
                _error: `record_observation rpc: ${rpcErr.message}`.slice(0, 500),
              });
              results.push({ id: row.id, market: row.market_id, session: row.session, status: "RPC_ERROR" });
              continue;
            }

            await supabase.rpc("update_scrape_retry_outcome", {
              _id: row.id,
              _success: true,
              _error: null,
            });
            await supabase.from("result_scrape_log").insert({
              market_id: row.market_id,
              session_date: row.session_date,
              session: row.session,
              source: row.source,
              status: "RETRY_OK",
              pana,
            });
            results.push({ id: row.id, market: row.market_id, session: row.session, status: "OK", pana });
          } catch (e: any) {
            const detail = {
              name: e?.name ?? "Error",
              message: String(e?.message ?? e).slice(0, 500),
              attempts: e?.attempts,
              lastStatus: e?.lastStatus,
            };
            console.error(
              `[process-scrape-queue] retry failed id=${row.id} market=${row.market_id} session=${row.session}`,
              detail,
            );
            await supabase.rpc("update_scrape_retry_outcome", {
              _id: row.id,
              _success: false,
              _error: detail.message,
            });
            await supabase.from("result_scrape_log").insert({
              market_id: row.market_id,
              session_date: row.session_date,
              session: row.session,
              source: row.source,
              status: "RETRY_FAIL",
              error: JSON.stringify(detail).slice(0, 1000),
            });
            results.push({ id: row.id, market: row.market_id, session: row.session, status: "RETRY_FAIL" });
          }
        }

        return json({ ok: true, processed: results.length, results });
      },
      GET: async () => json({ ok: true, hint: "POST to drain the retry queue" }),
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
