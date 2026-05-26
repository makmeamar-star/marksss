import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const OverrideInput = z.object({
  marketId: z.string().min(1).max(64),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.enum(["OPEN", "CLOSE"]),
  newPana: z.string().regex(/^\d{3}$/),
  reason: z.string().min(20).max(1000),
  confirm: z.literal("I_UNDERSTAND_THIS_RESETTLES"),
});

/**
 * Hard override of a declared result. Bypasses the 10-minute correction
 * window, reverses all settled bets, re-settles with the new pana, and
 * writes both an audit_log row and a system_alerts warning.
 */
export const adminOverrideResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OverrideInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await ensureAdmin(userId);

    const { data: rpc, error } = await supabaseAdmin.rpc("admin_override_result", {
      _market_id: data.marketId,
      _session_date: data.sessionDate,
      _session: data.session,
      _new_pana: data.newPana,
      _reason: data.reason,
      _confirm: data.confirm,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, result: rpc };
  });
