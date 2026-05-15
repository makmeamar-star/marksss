import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Side-effect hook that persists a curated set of TanStack Query caches to
 * localStorage so /markets and market detail pages render instantly on reload
 * — including when offline. Only read-mostly public caches are persisted;
 * user-private data (bets, wallet, profile) is never written to storage.
 *
 * Persisted query keys (first segment):
 *   - "markets"                    full market catalog (drives /markets, /bet/$id)
 *   - "latest-results-per-market"  homepage results grid
 *   - "results"                    results page per-date
 *   - "results-range"              charts/results range
 */

const PERSIST_KEYS = new Set<string>([
  "markets",
  "latest-results-per-market",
  "results",
  "results-range",
]);

const BUSTER = "v1"; // bump to invalidate persisted cache after schema changes

export function useQueryCachePersistence(client: QueryClient) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let persister;
    try {
      persister = createSyncStoragePersister({
        storage: window.localStorage,
        key: "sk-query-cache",
        throttleTime: 1500,
      });
    } catch {
      return;
    }

    const [unsubscribe] = persistQueryClient({
      queryClient: client as any,
      persister,
      maxAge: 24 * 60 * 60 * 1000, // 24h
      buster: BUSTER,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          const key = query.queryKey?.[0];
          if (typeof key !== "string") return false;
          if (!PERSIST_KEYS.has(key)) return false;
          // Only persist successful queries — avoid serving broken state offline.
          return query.state.status === "success";
        },
      },
    });

    // Nudge paused/refetch on reconnect.
    const onOnline = () => window.dispatchEvent(new Event("focus"));
    window.addEventListener("online", onOnline);

    return () => {
      unsubscribe?.();
      window.removeEventListener("online", onOnline);
    };
  }, [client]);
}
