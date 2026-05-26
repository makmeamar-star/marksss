import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached data when offline instead of throwing — critical for the
        // market list / detail pages so installed PWA users still see content.
        networkMode: "offlineFirst",
        // Treat data as fresh for 30s — kills the spinner storm on tab switches
        // and back/forward navigations. Realtime channels still push live updates.
        staleTime: 30_000,
        // Refetching on every focus thrashes the UI; rely on staleTime + realtime.
        refetchOnWindowFocus: false,
        refetchOnReconnect: "always",
        // Match our persistence window so persisted entries aren't immediately GC'd.
        gcTime: 24 * 60 * 60 * 1000, // 24h
        retry: (failureCount, error: any) => {
          // Don't burn retries when the browser knows it's offline.
          if (typeof navigator !== "undefined" && !navigator.onLine) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        // Mutations should not silently succeed offline — let the UI surface it.
        networkMode: "online",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route chunks + loaders on link hover/focus so clicks feel instant.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
