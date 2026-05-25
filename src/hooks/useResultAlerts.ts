import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMarketAlerts,
  setMarketAlert,
  subscribePush,
  unsubscribePush,
} from "@/lib/push.functions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapidPublicKey";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

export type PushSupport =
  | { supported: true; reason: null }
  | { supported: false; reason: "preview" | "no-sw" | "no-push" | "no-notif" | "ssr" };

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "ssr" };
  if (isInIframe() || isPreviewHost()) return { supported: false, reason: "preview" };
  if (!("serviceWorker" in navigator)) return { supported: false, reason: "no-sw" };
  if (!("PushManager" in window)) return { supported: false, reason: "no-push" };
  if (!("Notification" in window)) return { supported: false, reason: "no-notif" };
  return { supported: true, reason: null };
}

async function ensurePushSubscription(): Promise<PushSubscription | null> {
  const support = getPushSupport();
  if (!support.supported) return null;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) return sub;

  const perm =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (perm !== "granted") return null;

  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
  });
  return sub;
}

export function useResultAlerts() {
  const qc = useQueryClient();
  const fetchAlerts = useServerFn(getMarketAlerts);
  const setAlertFn = useServerFn(setMarketAlert);
  const subscribeFn = useServerFn(subscribePush);
  const unsubscribeFn = useServerFn(unsubscribePush);

  const support = useMemo(getPushSupport, []);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const id = setInterval(() => setPermission(Notification.permission), 2000);
    return () => clearInterval(id);
  }, []);

  const isAuthed = useAuthStore((s) => !!s.user);

  const alertsQuery = useQuery({
    queryKey: ["market-alerts"],
    queryFn: () => fetchAlerts(),
    staleTime: 60_000,
    enabled: isAuthed,
  });

  const enabledIds = useMemo(
    () => new Set(alertsQuery.data?.marketIds ?? []),
    [alertsQuery.data],
  );

  const toggleMutation = useMutation({
    mutationFn: async (vars: { marketId: string; enabled: boolean }) => {
      if (vars.enabled) {
        const sub = await ensurePushSubscription();
        if (!sub) throw new Error("permission-denied");
        const json = sub.toJSON();
        await subscribeFn({
          data: {
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
            userAgent: navigator.userAgent.slice(0, 500),
          },
        });
      }
      await setAlertFn({ data: { marketId: vars.marketId, enabled: vars.enabled } });
      return vars;
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["market-alerts"] });
      toast.success(vars.enabled ? "Alerts on for this market" : "Alerts off");
    },
    onError: (err: Error) => {
      if (err.message === "permission-denied") {
        toast.error("Enable notifications in your browser to receive alerts.");
      } else {
        toast.error("Couldn't update alert. Try again.");
      }
    },
  });

  const disableAll = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeFn({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      // Best-effort: clear all per-market prefs by toggling each off
      const ids = alertsQuery.data?.marketIds ?? [];
      await Promise.all(
        ids.map((id) => setAlertFn({ data: { marketId: id, enabled: false } })),
      );
      qc.invalidateQueries({ queryKey: ["market-alerts"] });
      toast.success("All result alerts disabled");
    } catch {
      toast.error("Couldn't disable alerts.");
    }
  }, [alertsQuery.data, qc, setAlertFn, unsubscribeFn]);

  return {
    support,
    permission,
    enabledIds,
    isLoading: alertsQuery.isLoading,
    toggle: (marketId: string, enabled: boolean) =>
      toggleMutation.mutate({ marketId, enabled }),
    isToggling: toggleMutation.isPending,
    disableAll,
  };
}
