import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const Filters = z.object({
  search: z.string().trim().max(120).optional().default(""),
  marketId: z.string().trim().max(64).optional().default(""),
  session: z.enum(["ALL", "OPEN", "CLOSE"]).optional().default("ALL"),
  status: z.enum(["ALL", "PENDING", "WON", "LOST"]).optional().default("ALL"),
  betType: z.string().trim().max(32).optional().default(""),
  fromDate: z.string().optional().default(""), // YYYY-MM-DD
  toDate: z.string().optional().default(""),
  minAmount: z.number().nonnegative().optional().nullable(),
  maxAmount: z.number().nonnegative().optional().nullable(),
  page: z.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.number().int().min(10).max(200).optional().default(50),
});

function applyFilters(q: any, f: z.infer<typeof Filters>) {
  if (f.marketId) q = q.eq("market_id", f.marketId);
  if (f.session !== "ALL") q = q.eq("session", f.session);
  if (f.status !== "ALL") q = q.eq("status", f.status);
  if (f.betType) q = q.eq("bet_type", f.betType);
  if (f.fromDate) q = q.gte("session_date", f.fromDate);
  if (f.toDate) q = q.lte("session_date", f.toDate);
  if (f.minAmount != null) q = q.gte("amount", f.minAmount);
  if (f.maxAmount != null) q = q.lte("amount", f.maxAmount);
  return q;
}

export const listBets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Filters.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("bets")
      .select(
        "id, user_id, market_id, session, session_date, bet_type, bet_number, amount, payout, win_amount, status, created_at, settled_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    q = applyFilters(q, data);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    // Resolve usernames
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let usernames = new Map<string, { username: string; email: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, email")
        .in("user_id", ids);
      for (const p of profs ?? []) usernames.set(p.user_id, { username: p.username, email: p.email });
    }

    // Aggregations across the same filter (without pagination)
    let aggQ = supabase.from("bets").select("amount, win_amount, status", { count: "exact", head: false });
    aggQ = applyFilters(aggQ, data);
    const { data: aggRows } = await aggQ.limit(10000);
    let totalAmount = 0,
      totalWin = 0,
      pendingExposure = 0,
      pending = 0,
      won = 0,
      lost = 0;
    for (const r of aggRows ?? []) {
      const amt = Number(r.amount ?? 0);
      totalAmount += amt;
      if (r.status === "PENDING") {
        pending += 1;
        pendingExposure += amt;
      } else if (r.status === "WON") {
        won += 1;
        totalWin += Number(r.win_amount ?? 0);
      } else if (r.status === "LOST") lost += 1;
    }

    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        username: usernames.get(r.user_id)?.username ?? "—",
        email: usernames.get(r.user_id)?.email ?? null,
      })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      agg: { totalAmount, totalWin, pendingExposure, pending, won, lost, count: aggRows?.length ?? 0 },
    };
  });

export const exportBetsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Filters.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    let q = supabase
      .from("bets")
      .select(
        "id, user_id, market_id, session, session_date, bet_type, bet_number, amount, payout, win_amount, status, created_at, settled_at"
      )
      .order("created_at", { ascending: false })
      .limit(10000);
    q = applyFilters(q, data);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const usernames = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, username").in("user_id", ids);
      for (const p of profs ?? []) usernames.set(p.user_id, p.username);
    }

    const header = [
      "id","created_at","user","market_id","session_date","session",
      "bet_type","bet_number","amount","payout","win_amount","status","settled_at",
    ];
    const escape = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(",")];
    for (const r of rows ?? []) {
      lines.push([
        r.id, r.created_at, usernames.get(r.user_id) ?? r.user_id,
        r.market_id, r.session_date, r.session, r.bet_type, r.bet_number,
        r.amount, r.payout, r.win_amount ?? "", r.status, r.settled_at ?? "",
      ].map(escape).join(","));
    }
    return { csv: lines.join("\n"), count: rows?.length ?? 0 };
  });
