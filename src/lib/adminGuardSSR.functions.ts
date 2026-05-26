import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * SSR-safe admin guard. Reads the access token from either:
 *  - the `Authorization: Bearer …` header (when called as a regular serverFn
 *    RPC from the client, via attachSupabaseAuth), OR
 *  - the `sb-access-token` cookie (set by useAuthCookieSync on the client),
 *    which is the path that works during SSR / `beforeLoad`.
 *
 * Returns `{ ok: true }` for admins, `{ ok: false }` otherwise — never throws,
 * so callers can decide whether to redirect (vs. surface a 403 page).
 */
export const requireAdminSSR = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: boolean }> => {
    let token: string | undefined;
    try {
      const authHeader = getRequestHeader("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice("Bearer ".length).trim() || undefined;
      }
      if (!token) {
        const cookieToken = getCookie("sb-access-token");
        if (cookieToken) token = cookieToken;
      }
    } catch {
      return { ok: false };
    }

    if (!token) return { ok: false };

    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) return { ok: false };
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return { ok: !!roleRow };
    } catch {
      return { ok: false };
    }
  },
);
