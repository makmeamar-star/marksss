// SattaKing Pro service worker
// Strategy: NetworkFirst for HTML navigations (3s timeout, falls back to cache),
// StaleWhileRevalidate for /assets/* and same-origin GETs.
// IMPORTANT: never registered on Lovable preview hosts (see RootComponent guard).

const VERSION = "v3";
const RUNTIME = `runtime-${VERSION}`;
const PRECACHE = `precache-${VERSION}`;
const NAV_TIMEOUT_MS = 3000;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    try {
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
    } catch {}
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
    const fallback = await cache.match("/");
    if (fallback) return fallback;
    const precache = await caches.open(PRECACHE);
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
