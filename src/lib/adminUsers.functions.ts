import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const ListInput = z.object({
  search: z.string().trim().max(120).optional().default(""),
  page: z.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.number().int().min(10).max(100).optional().default(25),
});

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("profiles")
      .select(
        "user_id, username, email, phone, balance, total_bet, total_win, total_deposit, total_withdraw, status, kyc_status, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.search) {
      const s = data.search.replace(/[,()]/g, "");
      q = q.or(`username.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.user_id);
    let admins = new Set<string>();
    if (ids.length) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids)
        .eq("role", "admin");
      admins = new Set((roles ?? []).map((r: any) => r.user_id));
    }

    return {
      rows: (rows ?? []).map((r: any) => ({ ...r, isAdmin: admins.has(r.user_id) })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const getUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const [profile, roles, bets, tx] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", data.userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.userId),
      supabase
        .from("bets")
        .select("id, market_id, session, bet_type, bet_number, amount, win_amount, status, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("wallet_transactions")
        .select("id, type, amount, balance_after, description, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    return {
      profile: profile.data,
      roles: (roles.data ?? []).map((r: any) => r.role as string),
      bets: bets.data ?? [],
      transactions: tx.data ?? [],
    };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), grant: z.boolean() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    if (data.grant) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: "admin" });
      // ignore unique violation
      if (error && !String(error.message).match(/duplicate|unique/i)) throw new Error(error.message);
    } else {
      if (data.userId === userId) throw new Error("You cannot revoke your own admin role.");
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });

export const adjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      delta: z.number().min(-10_000_000).max(10_000_000).refine((n) => n !== 0, "delta cannot be zero"),
      reason: z.string().trim().min(3).max(200),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: out, error } = await supabase.rpc("admin_adjust_balance", {
      _user_id: data.userId as string, _delta: data.delta as number, _reason: data.reason as string,
    } as any);
    if (error) throw new Error(error.message);
    return out as { success: boolean; before: number; after: number };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      status: z.enum(["ACTIVE", "SUSPENDED"]),
      reason: z.string().trim().min(3).max(200),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    if (data.userId === userId && data.status === "SUSPENDED") {
      throw new Error("You cannot suspend your own account.");
    }
    const { data: out, error } = await supabase.rpc("admin_set_user_status", {
      _user_id: data.userId as string, _status: data.status as string, _reason: data.reason as string,
    } as any);
    if (error) throw new Error(error.message);
    return out as { success: boolean; status: string };
  });
