/**
 * Multi-source scraper coordinator.
 * Currently implements dpboss as the primary source. Additional sources can
 * be added by exporting a function with the same shape and registering them
 * in SOURCES below.
 */

import { fetchDpbossPanel, type DpbossDayResult } from "./dpboss.server";

export type SourceName = "dpboss";

export interface ScrapedDay {
  date: string;          // YYYY-MM-DD
  openPana: string | null;
  closePana: string | null;
  jodi: string | null;
  source: SourceName;
}

/** In-process cache so a single cron tick doesn't re-fetch the same URL. */
const cache = new Map<string, { at: number; data: ScrapedDay[] }>();
const CACHE_TTL_MS = 60_000;

const SOURCES: Record<SourceName, (slug: string) => Promise<DpbossDayResult[]>> = {
  dpboss: fetchDpbossPanel,
};

/** Fetch all days available for a given market slug from a given source. */
export async function fetchAllForMarket(
  source: SourceName,
  slug: string,
): Promise<ScrapedDay[]> {
  const key = `${source}:${slug}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }
  const fn = SOURCES[source];
  const days = await fn(slug);
  const tagged: ScrapedDay[] = days.map((d) => ({ ...d, source }));
  cache.set(key, { at: Date.now(), data: tagged });
  return tagged;
}

/** Find the result for a specific date from a source. */
export async function fetchOneDay(
  source: SourceName,
  slug: string,
  date: string,
): Promise<ScrapedDay | null> {
  const days = await fetchAllForMarket(source, slug);
  return days.find((d) => d.date === date) ?? null;
}
