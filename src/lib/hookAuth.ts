import { createClient } from "@supabase/supabase-js";

/**
 * Shared auth guard for /api/public/hooks/* routes.
 *
 * Accepts (in order):
 *   1. x-hook-secret matching process.env.HOOK_SECRET
 *   2. x-hook-secret matching app_settings.hook_secret (the value pg_cron
 *      sends via get_hook_secret() — used as the canonical source of truth
 *      so the cron handshake can't drift from the runtime env var)
 *   3. Authorization: Bearer <supabase JWT> belonging to an admin user
 */
export async function requireHookSecret(request: Request): Promise<Response | null> {
  const provided = request.headers.get("x-hook-secret");
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const envSecret = process.env.HOOK_SECRET;
  if (envSecret && provided && provided === envSecret) return null;

  if (provided && url && serviceKey) {
    try {
      const adminClient = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await adminClient
        .from("app_settings")
        .select("value")
        .eq("key", "hook_secret")
        .maybeSingle();
      const dbSecret = (data?.value as { value?: string } | null)?.value;
      if (dbSecret && provided === dbSecret) return null;
    } catch {
      /* fall through */
    }
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (url && key && serviceKey && token) {
      try {
        const userClient = createClient(url, key, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData } = await userClient.auth.getUser();
        if (userData?.user) {
          const adminClient = createClient(url, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data: role } = await adminClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id)
            .eq("role", "admin")
            .maybeSingle();
          if (role) return null;
        }
      } catch {
        /* fall through to 401 */
      }
    }
  }

  return new Response("Unauthorized", { status: 401 });
}
