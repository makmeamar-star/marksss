import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function istTodayStr(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Admin gate
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!(roles ?? []).some((r) => r.role === "admin")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const today = istTodayStr();
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [
      betsToday,
      resultsToday,
      markets,
      automation,
      pendingDeposits,
      pendingWithdrawals,
      newUsers,
      audit,
      scrapeLog,
      clientErrors,
    ] = await Promise.all([
      supabase.from("bets").select("amount, win_amount, status, user_id").eq("session_date", today),
      supabase.from("market_results").select("*").eq("session_date", today),
      supabase.from("markets").select("id, display_name, open_time, close_time, status").eq("status", "ACTIVE"),
      supabase.from("market_automation").select("market_id, open_enabled, close_enabled, last_run_at"),
      supabase.from("deposit_requests").select("id, amount").eq("status", "PENDING"),
      supabase.from("withdrawal_requests").select("id, amount").eq("status", "PENDING"),
      supabase.from("profiles").select("user_id").gte("created_at", since24h),
      supabase
        .from("audit_log")
        .select("id, action, market_id, session, pana, actor_email, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("result_scrape_log")
        .select("id, market_id, session, status, run_at, error")
        .gte("run_at", since24h)
        .order("run_at", { ascending: false })
        .limit(50),
      supabase
        .from("client_errors")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24h),
    ]);

    const bets = betsToday.data ?? [];
    const activeUsers = new Set(bets.map((b) => b.user_id)).size;
    const betCount = bets.length;
    const betVolume = bets.reduce((s, b) => s + Number(b.amount ?? 0), 0);
    const grossPayout = bets.reduce((s, b) => s + Number(b.win_amount ?? 0), 0);

    const pendingDepAmt = (pendingDeposits.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const pendingWdAmt = (pendingWithdrawals.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

    const autoMap = new Map((automation.data ?? []).map((a) => [a.market_id, a]));
    const resMap = new Map((resultsToday.data ?? []).map((r) => [r.market_id, r]));
    const marketRows = (markets.data ?? []).map((m) => {
      const r = resMap.get(m.id);
      const a = autoMap.get(m.id);
      return {
        id: m.id,
        name: m.display_name,
        openTime: m.open_time,
        closeTime: m.close_time,
        openPana: r?.open_pana ?? null,
        closePana: r?.close_pana ?? null,
        autoOpen: !!a?.open_enabled,
        autoClose: !!a?.close_enabled,
      };
    });

    const scrapeRows = scrapeLog.data ?? [];
    const scrapeOk = scrapeRows.filter((r) => r.status === "SUCCESS").length;
    const scrapeFail = scrapeRows.filter((r) => r.status !== "SUCCESS").length;

    return {
      today,
      kpis: {
        activeUsers,
        newSignups: (newUsers.data ?? []).length,
        bets: betCount,
        betVolume,
        grossPayout,
        houseNet: betVolume - grossPayout,
        pendingDeposits: { count: (pendingDeposits.data ?? []).length, amount: pendingDepAmt },
        pendingWithdrawals: { count: (pendingWithdrawals.data ?? []).length, amount: pendingWdAmt },
      },
      markets: marketRows,
      activity: audit.data ?? [],
      health: {
        scrapeLastRunAt: scrapeRows[0]?.run_at ?? null,
        scrapeOk,
        scrapeFail,
        clientErrors24h: clientErrors.count ?? 0,
        automationLastRunAt:
          (automation.data ?? [])
            .map((a) => a.last_run_at)
            .filter(Boolean)
            .sort()
            .pop() ?? null,
      },
    };
  });
