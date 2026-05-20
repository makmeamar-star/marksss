// Lightweight analytics shim. Works with any analytics layer that listens to
// window.dataLayer (GA4, GTM, Plausible custom events via proxy). Falls back
// to a CustomEvent on `window` so app code can also listen locally.
//
// Safe to call from anywhere — no-ops during SSR.

type Props = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    plausible?: (event: string, opts?: { props?: Props }) => void;
    gtag?: (...args: unknown[]) => void;
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

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, props);
  }
}
