// Client-only: mirrors the Supabase access token into a cookie so server-side
// middleware (SSR/serverFn beforeLoad) can read & verify the session without
// relying on the Authorization header (which is only attached on serverFn RPCs).
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const COOKIE_NAME = "sb-access-token";

function setCookie(token: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    token,
  )}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function clearCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function useAuthCookieSync() {
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const session = data.session;
      if (session?.access_token) {
        const ttl = Math.max(
          60,
          Math.floor((session.expires_at ?? 0) - Date.now() / 1000),
        );
        setCookie(session.access_token, ttl || 3600);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        const ttl = Math.max(
          60,
          Math.floor((session.expires_at ?? 0) - Date.now() / 1000),
        );
        setCookie(session.access_token, ttl || 3600);
      } else {
        clearCookie();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);
}
