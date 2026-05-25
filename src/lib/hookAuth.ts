import { createClient } from "@supabase/supabase-js";

/**
 * Shared auth guard for /api/public/hooks/* routes.
 *
 * Accepts either:
 *   - x-hook-secret header matching process.env.HOOK_SECRET (used by pg_cron
 *     and other trusted backend callers)
 *   - Authorization: Bearer <supabase JWT> belonging to an admin user (used
 *     when the admin dashboard manually triggers a hook)
 *
 * Returns a Response on failure, or null on success.
 */
export async function requireHookSecret(request: Request): Promise<Response | null> {
  const expected = process.env.HOOK_SECRET;
  const provided = request.headers.get("x-hook-secret");
  if (expected && provided && provided === expected) return null;

  // Fall back to admin bearer token
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

  if (!expected) {
    return new Response("HOOK_SECRET not configured", { status: 500 });
  }
  return new Response("Unauthorized", { status: 401 });
}
