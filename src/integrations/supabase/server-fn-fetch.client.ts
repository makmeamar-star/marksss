// Client-only: attach the Supabase access token to every same-origin
// /_serverFn/* request so server functions guarded by requireSupabaseAuth
// receive a valid Bearer token.
import { supabase } from "./client";

if (typeof window !== "undefined" && !(window as any).__sbServerFnFetchPatched) {
  (window as any).__sbServerFnFetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  const isServerFnUrl = (url: string): boolean => {
    try {
      const u = new URL(url, window.location.origin);
      return u.origin === window.location.origin && u.pathname.startsWith("/_serverFn/");
    } catch {
      return false;
    }
  };

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (!isServerFnUrl(url)) {
      return originalFetch(input as any, init);
    }

    // Don't override if caller already set Authorization
    const existing = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!existing.has("authorization")) {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) existing.set("authorization", `Bearer ${token}`);
      } catch {
        // ignore — server will respond 401 if token missing
      }
    }

    if (input instanceof Request) {
      const merged = new Request(input, { ...init, headers: existing });
      return originalFetch(merged);
    }
    return originalFetch(input as any, { ...(init ?? {}), headers: existing });
  }) as typeof window.fetch;
}

export {};
