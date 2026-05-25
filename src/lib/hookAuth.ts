/**
 * Shared auth guard for /api/public/hooks/* routes.
 * Requires a matching `x-hook-secret` header against process.env.HOOK_SECRET.
 *
 * Returns a Response on failure, or null on success.
 */
export function requireHookSecret(request: Request): Response | null {
  const expected = process.env.HOOK_SECRET;
  if (!expected) {
    return new Response("HOOK_SECRET not configured", { status: 500 });
  }
  const provided = request.headers.get("x-hook-secret");
  if (!provided || provided !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
