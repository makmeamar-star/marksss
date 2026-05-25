import { supabase } from "@/integrations/supabase/client";

/**
 * Browser-side fetch helper for /api/public/hooks/* routes. Attaches the
 * current Supabase session bearer token so the route's admin-fallback auth
 * check accepts the request. Use only from admin-only screens.
 */
export async function callAdminHook(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}
