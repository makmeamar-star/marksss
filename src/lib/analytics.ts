// Lightweight analytics shim. Works with any analytics layer that listens to
// window.dataLayer (GA4, GTM, Plausible custom events via proxy). Falls back
// to a CustomEvent on `window` so app code can also listen locally.
//
// PWA install funnel events (pwa_*) are additionally persisted to Supabase
// so admins can analyse them in /admin/analytics/pwa.
//
// Safe to call from anywhere — no-ops during SSR.

import { supabase } from "@/integrations/supabase/client";

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    plausible?: (event: string, opts?: { props?: Props }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

const SESSION_KEY = "sk-analytics-session";

function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let v = sessionStorage.getItem(SESSION_KEY);
    if (!v) {
      v = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem(SESSION_KEY, v);
    }
    return v;
  } catch {
    return null;
  }
}

const PWA_EVENTS = new Set([
  "pwa_install_prompt_shown",
  "pwa_install_prompt_clicked",
  "pwa_install_prompt_outcome",
  "pwa_install_prompt_dismissed",
  "pwa_installed",
]);

async function persistPwaEvent(event: string, props: Props) {
  if (typeof window === "undefined") return;
  try {
    const platform = (props.platform === "android" || props.platform === "ios")
      ? (props.platform as string)
      : "other";
    const outcome = props.outcome === "accepted" || props.outcome === "dismissed"
      ? (props.outcome as string)
      : null;
    const source = props.source === "user" || props.source === "auto"
      ? (props.source as string)
      : null;
    const { data } = await supabase.auth.getSession();
    await supabase.from("pwa_install_events").insert({
      event,
      platform,
      outcome,
      source,
      session_id: getSessionId(),
      user_id: data.session?.user?.id ?? null,
      user_agent: window.navigator.userAgent.slice(0, 500),
    });
  } catch {
    // Never let analytics failures break the UI.
  }
}

export function track(event: string, props: Props = {}): void {
  if (typeof window === "undefined") return;

  const payload = { event, ...props, ts: Date.now() };

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  } catch {}

  try {
    window.gtag?.("event", event, props);
  } catch {}

  try {
    window.plausible?.(event, { props });
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent("analytics", { detail: payload }));
  } catch {}

  if (PWA_EVENTS.has(event)) {
    void persistPwaEvent(event, props);
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, props);
  }
}
