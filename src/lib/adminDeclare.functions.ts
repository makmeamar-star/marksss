import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const DeclareInput = z.object({
  marketId: z.string().min(1).max(64),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.enum(["OPEN", "CLOSE", "JODI"]),
  value: z.string().regex(/^\d{2,3}$/),
});

/**
 * Manual admin result declaration. Bypasses the scraper requirement by
 * inserting an `admin_manual` observation row first (which satisfies the
 * scraper-confirmation guard inside system_auto_declare), then calls the
 * publish RPC and audits the action.
 */
export const adminDeclareResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeclareInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    if (data.session === "JODI" && data.value.length !== 2) {
      throw new Error("JODI requires a 2-digit value");
    }
    if (data.session !== "JODI" && data.value.length !== 3) {
      throw new Error("OPEN/CLOSE require a 3-digit pana");
    }

    // Seed an admin-source observation so the DB guard inside
    // system_auto_declare lets this publish through.
    const { error: obsErr } = await supabaseAdmin
      .from("result_observations")
      .insert({
        market_id: data.marketId,
        session_date: data.sessionDate,
        session: data.session,
        source: "admin_manual",
        pana: data.value,
        seen_count: 1,
      });
    if (obsErr && !/duplicate|unique/i.test(obsErr.message)) {
      throw new Error(`Failed to record admin observation: ${obsErr.message}`);
    }

    let rpcRes: any;
    if (data.session === "JODI") {
      const { data: r, error } = await supabaseAdmin.rpc("system_auto_declare_jodi", {
        _market_id: data.marketId,
        _session_date: data.sessionDate,
        _jodi: data.value,
      });
      if (error) throw new Error(error.message);
      rpcRes = r;
    } else {
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
      action: "ADMIN_MANUAL_DECLARE",
      market_id: data.marketId,
      session_date: data.sessionDate,
      session: data.session,
      pana: data.value,
      reason: "Manual admin declaration via Declare Results screen",
    });

    return { ok: true as const, result: rpcRes };
  });
