import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SHOW_DELAY_MS = 2500; // shortly after results paint

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari
  if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  return (
    inIframe ||
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

function recentlyDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    return Date.now() - parseInt(v, 10) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPreviewHost()) return;
    if (isStandalone()) return;
    if (recentlyDismissed()) return;

    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    setIsIOS(iOS);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // Show after results have had time to render.
      setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS doesn't fire beforeinstallprompt — show our manual A2HS hint.
    let iosTimer: number | undefined;
    if (iOS) {
      iosTimer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome !== "accepted") dismiss();
      else setVisible(false);
    } catch {
      dismiss();
    } finally {
      setDeferred(null);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install SattaKing Pro app"
      className="fixed left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Install SattaKing Pro</p>
          {isIOS ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Tap <Share className="mx-0.5 inline h-3.5 w-3.5 align-text-bottom" /> Share, then
              <span className="font-medium text-foreground"> Add to Home Screen</span> for instant
              access to live results.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Get live results faster with one-tap access from your home screen.
            </p>
          )}
          {!isIOS && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={install} className="h-8">
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} className="h-8">
                Not now
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
