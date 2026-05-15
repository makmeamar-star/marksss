import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

/**
 * List unresolved scraper alerts (mismatches) and group with the
 * underlying observations so the admin can pick a value to publish.
 */
export const listScraperAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { data: alerts, error: alertsErr } = await supabase
      .from("system_alerts")
      .select("id, severity, source, title, message, context, created_at, resolved_at")
      .is("resolved_at", null)
      .in("source", ["scraper-mismatch"])
      .order("created_at", { ascending: false })
      .limit(200);
    if (alertsErr) throw new Error(alertsErr.message);

    // Group observations by (market, date, session) for any alert key we saw,
    // plus any session_date in the last 7 days that still has >0 observations
    // and no declared result yet — that's the admin's full triage queue.
    const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { data: obs, error: obsErr } = await supabaseAdmin
      .from("result_observations")
      .select("market_id, session_date, session, source, pana, seen_count, last_seen_at")
      .gte("session_date", sinceIso)
      .order("last_seen_at", { ascending: false });
    if (obsErr) throw new Error(obsErr.message);

    const { data: declared } = await supabaseAdmin
      .from("market_results")
      .select("market_id, session_date, status, open_pana, close_pana, jodi")
      .gte("session_date", sinceIso);
    const declaredKey = new Set(
      (declared ?? [])
        .filter((r: any) => r.status === "DECLARED")
        .map((r: any) => `${r.market_id}|${r.session_date}`),
    );

    type Group = {
      key: string;
      market_id: string;
      session_date: string;
      session: string;
      sources: { source: string; pana: string; seen_count: number; last_seen_at: string }[];
      conflict: boolean;
    };
    const groups = new Map<string, Group>();
    for (const o of obs ?? []) {
      // Skip if a result is already declared for that market+date
      if (declaredKey.has(`${o.market_id}|${o.session_date}`)) continue;
      const key = `${o.market_id}|${o.session_date}|${o.session}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          market_id: o.market_id,
          session_date: o.session_date,
          session: o.session,
          sources: [],
          conflict: false,
        };
        groups.set(key, g);
      }
      g.sources.push({
        source: o.source,
        pana: o.pana,
        seen_count: o.seen_count,
        last_seen_at: o.last_seen_at,
      });
    }
    for (const g of groups.values()) {
      const distinct = new Set(g.sources.map((s) => s.pana));
      g.conflict = distinct.size > 1;
    }

    return {
      alerts: alerts ?? [],
      groups: [...groups.values()].sort((a, b) =>
        b.session_date.localeCompare(a.session_date) || a.market_id.localeCompare(b.market_id),
      ),
    };
  });

/** Admin manually publishes a result, resolving any matching alerts. */
const PublishInput = z.object({
  marketId: z.string().min(1).max(64),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // 'OPEN' / 'CLOSE' for pana markets; 'JODI' for jodi-only markets
  session: z.enum(["OPEN", "CLOSE", "JODI"]),
  // 3-digit pana for OPEN/CLOSE, 2-digit jodi for JODI
  value: z.string().regex(/^\d{2,3}$/),
});

export const manualPublishResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PublishInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    let rpcRes: any;
    if (data.session === "JODI") {
      if (data.value.length !== 2) throw new Error("JODI requires a 2-digit value");
      const { data: r, error } = await supabaseAdmin.rpc("system_auto_declare_jodi", {
        _market_id: data.marketId,
        _session_date: data.sessionDate,
        _jodi: data.value,
      });
      if (error) throw new Error(error.message);
      rpcRes = r;
    } else {
      if (data.value.length !== 3) throw new Error("OPEN/CLOSE require a 3-digit pana");
      const { data: r, error } = await supabaseAdmin.rpc("system_auto_declare", {
        _market_id: data.marketId,
        _session_date: data.sessionDate,
        _session: data.session,
        _pana: data.value,
      });
      if (error) throw new Error(error.message);
      rpcRes = r;
    }

    // Resolve any unresolved alerts for this market+date+session
    await supabaseAdmin
      .from("system_alerts")
      .update({ resolved_at: new Date().toISOString(), resolved_by: userId })
      .is("resolved_at", null)
      .eq("source", "scraper-mismatch")
      .filter("context->>market_id", "eq", data.marketId)
      .filter("context->>session_date", "eq", data.sessionDate);

    // Audit
    await supabaseAdmin.from("audit_log").insert({
      actor_id: userId,
      action: "MANUAL_PUBLISH_FROM_ALERT",
      market_id: data.marketId,
      session_date: data.sessionDate,
      session: data.session,
      pana: data.value,
      reason: "Admin manual publish from alerts triage",
    });

    return { ok: true, result: rpcRes };
  });

/** Mark an alert as resolved without publishing (e.g. false alarm). */
const DismissInput = z.object({ alertId: z.string().uuid() });
export const dismissScraperAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DismissInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabaseAdmin
      .from("system_alerts")
      .update({ resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq("id", data.alertId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
