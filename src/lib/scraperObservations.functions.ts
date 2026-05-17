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

function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * List today's scraper observations grouped by (market, session) so the admin
 * can review every pending value before it becomes a live result. Groups where
 * the result is already DECLARED are excluded.
 */
export const listTodayObservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const today = istToday();

    const [{ data: obs, error: obsErr }, { data: declared }, { data: markets }] = await Promise.all([
      supabaseAdmin
        .from("result_observations")
        .select("market_id, session_date, session, source, pana, seen_count, first_seen_at, last_seen_at")
        .eq("session_date", today)
        .order("last_seen_at", { ascending: false }),
      supabaseAdmin
        .from("market_results")
        .select("market_id, session_date, status, open_pana, close_pana, jodi")
        .eq("session_date", today),
      supabaseAdmin
        .from("markets")
        .select("id, display_name, name, is_jodi_only, open_time, close_time"),
    ]);
    if (obsErr) throw new Error(obsErr.message);

    const declaredMap = new Map<string, any>(
      (declared ?? []).map((r: any) => [`${r.market_id}|${r.session_date}`, r]),
    );
    const marketMap = new Map<string, any>((markets ?? []).map((m: any) => [m.id, m]));

    type Source = {
      source: string;
      pana: string;
      seen_count: number;
      first_seen_at: string;
      last_seen_at: string;
    };
    type Group = {
      key: string;
      market_id: string;
      market_name: string;
      session_date: string;
      session: "OPEN" | "CLOSE" | "JODI";
      sources: Source[];
      conflict: boolean;
      already_declared: boolean;
    };

    const groups = new Map<string, Group>();
    for (const o of obs ?? []) {
      const key = `${o.market_id}|${o.session_date}|${o.session}`;
      const declRow = declaredMap.get(`${o.market_id}|${o.session_date}`);
      // Skip session if that side is already declared
      if (declRow) {
        if (o.session === "OPEN" && declRow.open_pana) continue;
        if (o.session === "CLOSE" && declRow.close_pana) continue;
        if (o.session === "JODI" && declRow.jodi) continue;
      }
      const m = marketMap.get(o.market_id);
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          market_id: o.market_id,
          market_name: m?.display_name ?? m?.name ?? o.market_id,
          session_date: o.session_date,
          session: o.session as Group["session"],
          sources: [],
          conflict: false,
          already_declared: false,
        };
        groups.set(key, g);
      }
      g.sources.push({
        source: o.source,
        pana: o.pana,
        seen_count: o.seen_count,
        first_seen_at: o.first_seen_at,
        last_seen_at: o.last_seen_at,
      });
    }
    for (const g of groups.values()) {
      g.conflict = new Set(g.sources.map((s) => s.pana)).size > 1;
    }

    return {
      today,
      groups: [...groups.values()].sort(
        (a, b) =>
          Number(b.conflict) - Number(a.conflict) ||
          a.market_name.localeCompare(b.market_name) ||
          a.session.localeCompare(b.session),
      ),
    };
  });

/**
 * Approve a specific pana/jodi value for a (market, session, today) and
 * publish it. Goes through system_auto_declare which (a) requires a matching
 * observation to exist (which it does because the admin picked one), and
 * (b) settles all pending bets atomically.
 */
const ApproveInput = z.object({
  marketId: z.string().min(1).max(64),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.enum(["OPEN", "CLOSE", "JODI"]),
  value: z.string().regex(/^\d{2,3}$/),
});

export const approveObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ApproveInput.parse(input))
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

    await supabaseAdmin.from("audit_log").insert({
      actor_id: userId,
      action: "ADMIN_APPROVE_OBSERVATION",
      market_id: data.marketId,
      session_date: data.sessionDate,
      session: data.session,
      pana: data.value,
      reason: "Admin approved scraper observation",
    });

    return { ok: true, result: rpcRes };
  });

/**
 * Reject every observation for a (market, session, today) so the scraper has
 * to re-fetch from sources before another approval is possible.
 */
const RejectInput = z.object({
  marketId: z.string().min(1).max(64),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.enum(["OPEN", "CLOSE", "JODI"]),
  reason: z.string().min(3).max(500).optional(),
});

/**
 * Per-market scraper coverage report. Buckets every ACTIVE market into:
 *   AUTO_READY        — has >=2 distinct enabled sources (auto-declare possible)
 *   NEEDS_SECOND      — has exactly 1 enabled source (manual-only until a second is added)
 *   MANUAL_ONLY       — has 0 enabled sources
 *   CONFLICT          — today has observations from >=2 sources that disagree
 */
export const getScraperCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const today = istToday();

    const [{ data: markets }, { data: mapping }, { data: obs }] = await Promise.all([
      supabaseAdmin
        .from("markets")
        .select("id, display_name, status")
        .eq("status", "ACTIVE")
        .order("display_name"),
      supabaseAdmin
        .from("market_source_map")
        .select("market_id, source, enabled"),
      supabaseAdmin
        .from("result_observations")
        .select("market_id, session, source, pana")
        .eq("session_date", today),
    ]);

    // Build per-market source list
    const sourcesByMarket = new Map<string, string[]>();
    for (const m of mapping ?? []) {
      if (!m.enabled) continue;
      const arr = sourcesByMarket.get(m.market_id) ?? [];
      if (!arr.includes(m.source)) arr.push(m.source);
      sourcesByMarket.set(m.market_id, arr);
    }

    // Detect conflicts today
    const conflictMap = new Map<string, Set<string>>(); // market_id -> set of distinct panas
    for (const o of obs ?? []) {
      const key = `${o.market_id}|${o.session}`;
      const set = conflictMap.get(key) ?? new Set<string>();
      set.add(o.pana);
      conflictMap.set(key, set);
    }
    const marketsWithConflict = new Set<string>();
    for (const [k, panas] of conflictMap) {
      if (panas.size > 1) marketsWithConflict.add(k.split("|")[0]);
    }

    const rows = (markets ?? []).map((m) => {
      const srcs = sourcesByMarket.get(m.id) ?? [];
      const conflict = marketsWithConflict.has(m.id);
      let status: "AUTO_READY" | "NEEDS_SECOND" | "MANUAL_ONLY" | "CONFLICT";
      if (conflict) status = "CONFLICT";
      else if (srcs.length >= 2) status = "AUTO_READY";
      else if (srcs.length === 1) status = "NEEDS_SECOND";
      else status = "MANUAL_ONLY";
      return {
        market_id: m.id,
        market_name: m.display_name,
        sources: srcs,
        source_count: srcs.length,
        status,
      };
    });

    const counts = {
      AUTO_READY: rows.filter((r) => r.status === "AUTO_READY").length,
      NEEDS_SECOND: rows.filter((r) => r.status === "NEEDS_SECOND").length,
      MANUAL_ONLY: rows.filter((r) => r.status === "MANUAL_ONLY").length,
      CONFLICT: rows.filter((r) => r.status === "CONFLICT").length,
    };

    return { today, counts, rows };
  });

export const rejectObservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RejectInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { error } = await supabaseAdmin
      .from("result_observations")
      .delete()
      .eq("market_id", data.marketId)
      .eq("session_date", data.sessionDate)
      .eq("session", data.session);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: userId,
      action: "ADMIN_REJECT_OBSERVATIONS",
      market_id: data.marketId,
      session_date: data.sessionDate,
      session: data.session,
      reason: data.reason ?? "Admin rejected scraper observations",
    });

    return { ok: true };
  });
