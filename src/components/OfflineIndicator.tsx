import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * Small banner that appears at the bottom of the screen when the browser
 * reports it's offline. SPA navigations don't hit the SW, so this gives users
 * a clear in-app signal that cached content may be shown and writes will fail.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      window.setTimeout(() => setJustReconnected(false), 2500);
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))] pointer-events-none`}
    >
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-md border transition-all ${
          online
            ? "bg-emerald-500/90 border-emerald-400/50 text-white"
            : "bg-destructive/90 border-destructive/50 text-destructive-foreground"
        }`}
      >
        {online ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Back online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>You're offline — showing cached content</span>
          </>
        )}
      </div>
    </div>
  );
}
