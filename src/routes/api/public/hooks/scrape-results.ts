import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fetchAllForMarket, mapToRealDpbossDate, type SourceName } from "@/lib/scraper/index.server";
import { requireHookSecret } from "@/lib/hookAuth";

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
      POST: async ({ request }) => {
        const denied = requireHookSecret(request);
        if (denied) return denied;
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Optional body: { market_id?: string } to scope a single-market re-scrape.
        let onlyMarketId: string | null = null;
        try {
          const text = await request.text();
          if (text) {
            const body = JSON.parse(text);
            if (typeof body?.market_id === "string" && body.market_id.length <= 64) {
              onlyMarketId = body.market_id;
            }
          }
        } catch {}

        // IST today
        const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
        const today = nowIst.toISOString().slice(0, 10);

        let mapQuery = supabase
          .from("market_source_map")
          .select("market_id, source, slug")
          .eq("enabled", true);
        if (onlyMarketId) mapQuery = mapQuery.eq("market_id", onlyMarketId);
        const { data: maps, error: mapErr } = await mapQuery;
        if (mapErr) {
          return json({ ok: false, error: mapErr.message }, 500);
        }

        // Load jodi-only flag per market (avoids per-row queries)
        const { data: marketRows } = await supabase
          .from("markets")
          .select("id, is_jodi_only");
        const jodiOnly = new Set<string>(
          (marketRows ?? [])
            .filter((m: any) => m.is_jodi_only)
            .map((m: any) => m.id),
        );

        const summary: any[] = [];

        const lookupDate = mapToRealDpbossDate(today);

        for (const m of maps ?? []) {
          // ---- Jodi-only path: single observation per day, no OPEN/CLOSE ----
          if (jodiOnly.has(m.market_id)) {
            try {
              const days = await fetchAllForMarket(m.source as SourceName, m.slug);
              const todayRow = days.find((d) => d.date === lookupDate);
              const jodi = todayRow?.jodi ?? null;
              if (!jodi) {
                await supabase.from("result_scrape_log").insert({
                  market_id: m.market_id,
                  session_date: today,
                  session: "JODI",
                  source: m.source,
                  status: "NOT_YET",
                });
                continue;
              }
              const { data: rpc, error: rpcErr } = await supabase.rpc(
                "record_jodi_observation_and_maybe_declare" as any,
                {
                  _market_id: m.market_id,
                  _session_date: today,
                  _source: m.source,
                  _jodi: jodi,
                },
              );
              if (rpcErr) {
                await supabase.from("result_scrape_log").insert({
                  market_id: m.market_id,
                  session_date: today,
                  session: "JODI",
                  source: m.source,
                  status: "RPC_ERROR",
                  pana: jodi,
                  error: rpcErr.message,
                });
                summary.push({ market: m.market_id, session: "JODI", error: rpcErr.message });
              } else {
                const rpcStatus = ((rpc as any)?.status as string) ?? "OK";
                const logStatus =
                  rpcStatus === "DECLARED"
                    ? "OK"
                    : rpcStatus === "SKIPPED_DECLARED"
                      ? "SKIPPED_DECLARED"
                      : rpcStatus === "MISMATCH"
                        ? "MISMATCH"
                        : "AWAITING_CONFIRMATION";
                await supabase.from("result_scrape_log").insert({
                  market_id: m.market_id,
                  session_date: today,
                  session: "JODI",
                  source: m.source,
                  status: logStatus,
                  pana: jodi,
                });
                summary.push({ market: m.market_id, session: "JODI", jodi, status: logStatus });
              }
            } catch (e: any) {
              const detail = {
                name: e?.name ?? "Error",
                message: String(e?.message ?? e),
              };
              await supabase.from("result_scrape_log").insert({
                market_id: m.market_id,
                session_date: today,
                session: "JODI",
                source: m.source,
                status: "FETCH_ERROR",
                error: JSON.stringify(detail).slice(0, 1000),
              });
              summary.push({ market: m.market_id, session: "JODI", error: detail.message });
            }
            continue;
          }


          for (const session of ["OPEN", "CLOSE"] as const) {
            try {
              const days = await fetchAllForMarket(m.source as SourceName, m.slug);
              const todayRow = days.find((d) => d.date === lookupDate);
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

              // Confirm-twice: record observation; only auto-declares once
              // the same pana has been confirmed (>=2 sources or 2 spaced sightings).
              const { data: rpc, error: rpcErr } = await supabase.rpc(
                "record_observation_and_maybe_declare",
                {
                  _market_id: m.market_id,
                  _session_date: today,
                  _session: session,
                  _source: m.source,
                  _pana: pana,
                },
              );

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
                const rpcStatus = ((rpc as any)?.status as string) ?? "OK";
                // Map RPC status -> log status (kept compatible with existing values)
                const logStatus =
                  rpcStatus === "DECLARED"
                    ? "OK"
                    : rpcStatus === "SKIPPED_DECLARED"
                      ? "SKIPPED_DECLARED"
                      : rpcStatus === "MISMATCH"
                        ? "MISMATCH"
                        : "AWAITING_CONFIRMATION";
                await supabase.from("result_scrape_log").insert({
                  market_id: m.market_id,
                  session_date: today,
                  session,
                  source: m.source,
                  status: logStatus,
                  pana,
                });
                summary.push({ market: m.market_id, session, pana, status: logStatus });
              }
            } catch (e: any) {
              const detail = {
                name: e?.name ?? "Error",
                message: String(e?.message ?? e),
                attempts: e?.attempts,
                lastStatus: e?.lastStatus,
                url: e?.url,
              };
              console.error(
                `[scrape-results] FETCH_ERROR market=${m.market_id} session=${session} source=${m.source}`,
                detail,
              );
              await supabase.from("result_scrape_log").insert({
                market_id: m.market_id,
                session_date: today,
                session,
                source: m.source,
                status: "FETCH_ERROR",
                error: JSON.stringify(detail).slice(0, 1000),
              });
              // Enqueue for the retry-queue processor.
              await supabase.rpc("enqueue_scrape_retry", {
                _market_id: m.market_id,
                _session_date: today,
                _session: session,
                _source: m.source,
                _slug: m.slug,
                _error: detail.message.slice(0, 500),
              });
              summary.push({ market: m.market_id, session, error: detail.message, queued: true });
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
