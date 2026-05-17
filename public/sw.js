// SattaKing Pro service worker
// Strategy: NetworkFirst for HTML navigations (3s timeout, falls back to cache),
// StaleWhileRevalidate for /assets/* and same-origin GETs.
// IMPORTANT: never registered on Lovable preview hosts (see RootComponent guard).

const VERSION = "v5";
const RUNTIME = `runtime-${VERSION}`;
const PRECACHE = `precache-${VERSION}`;
const NAV_TIMEOUT_MS = 3000;
const OFFLINE_URL = "/offline.html";

// Key navigation routes precached at install so they render offline even if
// the user hasn't visited them this session. The TanStack Query cache
// (persisted in localStorage by PersistedQueryProvider) rehydrates the data.
const PRECACHE_ROUTES = ["/", "/results", "/markets", "/charts", "/jodi"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    try {
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
    } catch {}
    // Best-effort precache of route HTML — failures (e.g. offline install)
    // must not block activation.
    await Promise.all(
      PRECACHE_ROUTES.map(async (path) => {
        try {
          const res = await fetch(path, { cache: "reload", credentials: "same-origin" });
          if (res && res.ok) await cache.put(path, res.clone());
        } catch {}
      })
    );
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const keep = new Set([RUNTIME, PRECACHE]);
    await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isNavigation(req) {
  return req.mode === "navigate";
}

function isCachableAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Skip cross-origin (Supabase, analytics, etc.) — let the browser handle it.
  if (url.origin !== self.location.origin) return;

  // Skip API routes — they should always go to network.
  if (url.pathname.startsWith("/api/")) return;
  // Skip server function endpoints.
  if (url.pathname.startsWith("/_serverFn/")) return;

  if (isNavigation(req)) {
    event.respondWith(networkFirstHTML(req));
    return;
  }

  if (isCachableAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirstHTML(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const network = await Promise.race([
      fetch(request),
      new Promise((_, rej) => setTimeout(() => rej(new Error("nav-timeout")), NAV_TIMEOUT_MS)),
    ]);
    if (network && network.ok) {
      cache.put(request, network.clone()).catch(() => {});
    }
    return network;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const precache = await caches.open(PRECACHE);
    // Try the requested path from the precache (covers cold-start navigations
    // like first-ever visit to /results while offline).
    const url = new URL(request.url);
    const precachedPath = await precache.match(url.pathname);
    if (precachedPath) return precachedPath;
    const fallback = await cache.match("/") || await precache.match("/");
    if (fallback) return fallback;
    const offline = await precache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((res) => {
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  }).catch(() => undefined);
  return cached || (await networkPromise) || new Response("", { status: 504 });
}

// Allow page to trigger immediate activation after deploy.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ---- Web Push: result alerts ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "New result", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Result declared";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "result-alert",
    renotify: true,
    data: { url: data.url || "/results" },
    vibrate: [120, 60, 120],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/results";
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of allClients) {
      try {
        const url = new URL(c.url);
        if (url.origin === self.location.origin) {
          await c.focus();
          if ("navigate" in c) await c.navigate(target);
          return;
        }
      } catch {}
    }
    await self.clients.openWindow(target);
  })());
});
