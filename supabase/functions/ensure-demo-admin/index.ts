// Promotes the demo admin account to the admin role.
// Runs server-side with the service role key so we don't need a SECURITY DEFINER
// function exposed in the public schema (avoids Supabase linter warnings 0028/0029).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DEMO_ADMIN_EMAIL = "admin@sattaking.test";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Identify caller from the JWT
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return json({ ok: false, reason: "unauthorized" }, 401);
    }
    const user = userRes.user;

    // Hard guards
    if ((user.email ?? "").toLowerCase() !== DEMO_ADMIN_EMAIL) {
      return json({ ok: false, reason: "not_demo_admin" }, 403);
    }
    if (!user.email_confirmed_at) {
      return json({ ok: false, reason: "email_not_confirmed" }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Idempotent: skip if already admin
    const { data: existing } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await admin
        .from("user_roles")
        .insert({ user_id: user.id, role: "admin" });
      if (insErr) return json({ ok: false, reason: insErr.message }, 500);

      await admin.from("audit_log").insert({
        actor_id: user.id,
        actor_email: user.email,
        action: "DEMO_ADMIN_PROMOTE",
        reason: "ensure-demo-admin edge function granted admin role",
        metadata: { source: "edge:ensure-demo-admin" },
      });
    }

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, reason: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
