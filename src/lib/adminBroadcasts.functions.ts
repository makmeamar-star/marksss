import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const broadcastSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(500),
  link: z.string().max(200).optional().nullable(),
  audience: z.enum(["ALL", "ACTIVE", "USER"]),
  userId: z.string().uuid().optional().nullable(),
});

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => broadcastSchema.parse(input))
  .handler(async ({ context, data }) => {
    // ensure caller is admin
    const { data: roles, error: rolesErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesErr) throw new Error(rolesErr.message);
    if (!(roles ?? []).some((r) => r.role === "admin")) {
      throw new Error("ADMIN_REQUIRED");
    }

    let userIds: string[] = [];
    if (data.audience === "USER") {
      if (!data.userId) throw new Error("userId required for USER audience");
      userIds = [data.userId];
    } else {
      let q = supabaseAdmin.from("profiles").select("user_id");
      if (data.audience === "ACTIVE") q = q.eq("status", "ACTIVE");
      const { data: profiles, error } = await q;
      if (error) throw new Error(error.message);
      userIds = (profiles ?? []).map((p) => p.user_id);
    }

    if (userIds.length === 0) return { sent: 0 };

    const rows = userIds.map((uid) => ({
      user_id: uid,
      type: "broadcast",
      title: data.title,
      body: data.body,
      link: data.link ?? null,
      metadata: { sent_by: context.userId, audience: data.audience },
    }));

    // chunk inserts to stay safe
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const { error } = await supabaseAdmin.from("notifications").insert(slice);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "BROADCAST",
      reason: data.title,
      metadata: { audience: data.audience, sent: rows.length, body: data.body },
    });

    return { sent: rows.length };
  });

export const listRecentBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "admin")) {
      throw new Error("ADMIN_REQUIRED");
    }
    const { data, error } = await supabaseAdmin
      .from("audit_log")
      .select("*")
      .eq("action", "BROADCAST")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
