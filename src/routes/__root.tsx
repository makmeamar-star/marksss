import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/stores/authStore";
import { ErrorMonitor } from "@/components/ErrorMonitor";
import { AgeGate } from "@/components/AgeGate";
import { reportError } from "@/lib/errorReporter";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useQueryCachePersistence } from "@/components/PersistedQueryProvider";
import { useAuthCookieSync } from "@/lib/authCookieSync";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";

import appCss from "../styles.css?url";

function HomeHref() {
  // Prefer dashboard for signed-in users; falls back to "/" for guests.
  const user = useAuthStore((s) => s.user);
  return user ? "/dashboard" : "/";
}

function NotFoundComponent() {
  const homeTo = HomeHref();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to={homeTo}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {homeTo === "/dashboard" ? "Back to dashboard" : "Go home"}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const homeTo = HomeHref();
  useEffect(() => {
    void reportError({ error, source: "react" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to={homeTo}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {homeTo === "/dashboard" ? "Back to dashboard" : "Go home"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "SattaKing" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { title: "SattaKing Pro — India's Most Trusted Matka Platform" },
      { name: "description", content: "Live Matka results, instant settlements, and a beautifully crafted betting experience. Kalyan, Main Mumbai, Milan, Rajdhani, Gali, Disawar and more." },
      { name: "author", content: "SattaKing Pro" },
      { name: "keywords", content: "matka, satta, satta king, kalyan result, main mumbai result, gali disawar, jodi, matka chart" },
      { property: "og:site_name", content: "SattaKing Pro" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_IN" },
      { property: "og:title", content: "SattaKing Pro — India's Most Trusted Matka Platform" },
      { property: "og:description", content: "Live Matka results, instant settlements, and a beautifully crafted betting experience. Kalyan, Main Mumbai, Milan, Rajdhani, Gali, Disawar and more." },
      { property: "og:image", content: "https://matka.world/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SattaKing Pro — India's Most Trusted Matka Platform" },
      { name: "twitter:description", content: "Live Matka results, instant settlements, and a beautifully crafted betting experience. Kalyan, Main Mumbai, Milan, Rajdhani, Gali, Disawar and more." },
      { name: "twitter:image", content: "https://matka.world/og-image.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "preconnect", href: "https://kpahmkjutkfyhydfgffh.supabase.co", crossOrigin: "anonymous" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const hydrated = useAuthStore((s) => s.hydrated);
  useQueryCachePersistence(queryClient);
  useAuthCookieSync();
  useEffect(() => {
    if (!hydrated) void bootstrap();
  }, [hydrated, bootstrap]);

  // Register PWA service worker — but never inside the Lovable editor preview
  // iframe or on preview hosts (it would cache stale builds).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const host = window.location.hostname;
    const isPreview =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host === "localhost" ||
      host === "127.0.0.1";
    if (inIframe || isPreview) {
      // Aggressively unregister any SW that may have been installed earlier.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorMonitor />
      <Outlet />
      <BottomNav />
      <AgeGate />
      <OfflineIndicator />
      <InstallPrompt />
      <Toaster theme="dark" position="top-right" richColors />
    </QueryClientProvider>
  );
}
