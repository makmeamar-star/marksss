import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { fetchAllForMarket, mapToRealDpbossDate, type SourceName } from "@/lib/scraper/index.server";

/**
 * Backfill historical results from scraper sources into market_results.
 * Body: { from?: "YYYY-MM-DD", to?: "YYYY-MM-DD", marketIds?: string[] }
 *
 * For each (market, date) within range that doesn't already have a declared
 * result, writes the scraped open/close pana directly to market_results.
 * Does NOT re-settle bets (history-only).
 */
export const Route = createFileRoute("/api/public/hooks/backfill-results")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const body = await request.json().catch(() => ({})) as {
          from?: string;
          to?: string;
          marketIds?: string[];
        };
        const from = body.from;
        const to = body.to;

        let q = supabase
          .from("market_source_map")
          .select("market_id, source, slug")
          .eq("enabled", true);
        if (body.marketIds?.length) q = q.in("market_id", body.marketIds);
        const { data: maps, error: mapErr } = await q;
        if (mapErr) return json({ ok: false, error: mapErr.message }, 500);

        let written = 0;
        const errors: any[] = [];

        // Build IST date list to backfill
        const istDates: string[] = [];
        if (from && to) {
          const start = new Date(from + "T00:00:00Z");
          const end = new Date(to + "T00:00:00Z");
          for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
            istDates.push(new Date(t).toISOString().slice(0, 10));
          }
        }

        for (const m of maps ?? []) {
          try {
            const days = await fetchAllForMarket(m.source as SourceName, m.slug);
            const byDate = new Map(days.map((d) => [d.date, d]));

            // If no explicit range, fall back to whatever the scraper returned.
            const targets = istDates.length
              ? istDates.map((ist) => ({ ist, real: mapToRealDpbossDate(ist) }))
              : days.map((d) => ({ ist: d.date, real: d.date }));

            for (const { ist, real } of targets) {
              const d = byDate.get(real);
              if (!d || (!d.openPana && !d.closePana)) continue;

              const panasToCheck = [d.openPana, d.closePana].filter(Boolean) as string[];
              const { data: chart } = await supabase
                .from("pana_chart")
                .select("pana, digit")
                .in("pana", panasToCheck);
              const lookup = new Map((chart ?? []).map((r) => [r.pana, r.digit]));

              const open_pana = d.openPana && lookup.has(d.openPana) ? d.openPana : null;
              const close_pana = d.closePana && lookup.has(d.closePana) ? d.closePana : null;
              if (!open_pana && !close_pana) continue;

              const open_digit = open_pana ? lookup.get(open_pana)! : null;
              const close_digit = close_pana ? lookup.get(close_pana)! : null;
              const jodi =
                open_digit !== null && close_digit !== null
                  ? `${open_digit}${close_digit}`
                  : null;

              const { data: existing } = await supabase
                .from("market_results")
                .select("market_id, open_pana, close_pana")
                .eq("market_id", m.market_id)
                .eq("session_date", ist)
                .maybeSingle();

              if (existing && existing.open_pana && existing.close_pana) continue;

              const upsert: any = {
                market_id: m.market_id,
                session_date: ist,
                status: "DECLARED",
                declared_at: new Date().toISOString(),
              };
              if (open_pana) {
                upsert.open_pana = open_pana;
                upsert.open_digit = open_digit;
              } else if (existing?.open_pana) {
                upsert.open_pana = existing.open_pana;
              }
              if (close_pana) {
                upsert.close_pana = close_pana;
                upsert.close_digit = close_digit;
              } else if (existing?.close_pana) {
                upsert.close_pana = existing.close_pana;
              }
              if (jodi) upsert.jodi = jodi;

              const { error: upErr } = await supabase
                .from("market_results")
                .upsert(upsert, { onConflict: "market_id,session_date" });
              if (upErr) errors.push({ market: m.market_id, date: ist, error: upErr.message });
              else written++;
            }
          } catch (e: any) {
            errors.push({ market: m.market_id, error: String(e?.message ?? e) });
          }
        }

        return json({ ok: true, written, errors });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
