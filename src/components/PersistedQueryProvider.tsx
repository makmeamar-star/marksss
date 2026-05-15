import { useEffect, useState, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Persists a curated set of TanStack Query caches to localStorage so the app
 * shows instant content on reload — including when offline. We only persist
 * read-mostly caches that are safe to display stale (markets, results, charts).
 *
 * Keys persisted:
 *   - ["markets"]                    — full market catalog
 *   - ["latest-results-per-market"]  — homepage results grid
 *   - ["results", date]              — results page per-date
 *   - ["results-range", days]        — charts/results range
 *
 * NEVER persisted: ["my-bets"], wallet, profile, anything user-private.
 */

const PERSIST_KEYS = new Set<string>([
  "markets",
  "latest-results-per-market",
  "results",
  "results-range",
]);

const BUSTER = "v1"; // bump to invalidate persisted cache after schema changes

export function PersistedQueryProvider({
  client,
  children,
}: {
  client: QueryClient;
  children: ReactNode;
}) {
  // Only set up the persister in the browser — localStorage is unavailable in SSR.
  const [persister] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      return createSyncStoragePersister({
        storage: window.localStorage,
        key: "sk-query-cache",
        throttleTime: 1500,
      });
    } catch {
      return null;
    }
  });

  // Fall back to the regular provider during SSR / when storage is blocked.
  if (!persister) {
    // Lazy require to avoid pulling QueryClientProvider in unless needed.
    const { QueryClientProvider } = require("@tanstack/react-query");
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24h
        buster: BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey?.[0];
            if (typeof key !== "string") return false;
            if (!PERSIST_KEYS.has(key)) return false;
            // Don't persist queries that errored — avoid serving broken state offline.
            return query.state.status === "success";
          },
        },
      }}
    >
      <OnlineRefetchOnReconnect />
      {children}
    </PersistQueryClientProvider>
  );
}

/**
 * When the browser comes back online, refresh persisted caches in the
 * background so users see updated data without a manual reload.
 */
function OnlineRefetchOnReconnect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      // PersistQueryClientProvider already wires focusManager; this just nudges
      // the network manager to retry paused queries immediately.
      window.dispatchEvent(new Event("focus"));
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return null;
}
