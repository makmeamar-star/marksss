import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requireHookSecret } from "@/lib/hookAuth";

export const Route = createFileRoute("/api/public/hooks/auto-declare-results")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await requireHookSecret(request);
        if (denied) return denied;
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data, error } = await supabase.rpc("run_due_auto_declarations");
        if (error) {
          console.error("auto-declare error", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => {
        return new Response(JSON.stringify({ ok: true, hint: "POST to trigger" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
