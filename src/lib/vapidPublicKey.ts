// Web Push VAPID public key (safe to expose; private key lives as a server secret).
export const VAPID_PUBLIC_KEY =
  "BOfDLr7ngoGzI3tajouw_wPBS7r7i1sLz6asbBB0fuuzOZzJXd2U0Z2rNk0mi0Vvea7_xFi6v9I_xhHHYwAzfdU";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
