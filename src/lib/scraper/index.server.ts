/**
 * Multi-source scraper coordinator.
 * Currently implements dpboss as the primary source. Additional sources can
 * be added by exporting a function with the same shape and registering them
 * in SOURCES below.
 */

import { fetchDpbossPanel, type DpbossDayResult } from "./dpboss.server";
import { fetchSattamatkadpbossPanel } from "./sattamatkadpboss.server";
import { fetchFixresultPanel } from "./fixresult.server";
import { fetchSattakingvipPanel } from "./sattakingvip.server";
import { fetchGaliDisawarChart } from "./galidisawar.server";

export type SourceName =
  | "dpboss"
  | "sattamatkadpboss"
  | "fixresult"
  | "sattakingvip"
  | "galidisawar";

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
  sattamatkadpboss: fetchSattamatkadpbossPanel,
  fixresult: fetchFixresultPanel,
  sattakingvip: fetchSattakingvipPanel,
  galidisawar: fetchGaliDisawarChart,
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

/**
 * Map a (possibly future) IST date to the most recent real-calendar date
 * with the SAME weekday that is <= today's real UTC date. dpboss only
 * publishes results for actual past dates, so when the app's clock runs
 * ahead of real time we look up the equivalent prior real date.
 *
 * Example: IST 2026-05-09 (Sat) -> 2025-05-10 (Sat).
 * If the input date is already <= real today, it is returned unchanged.
 */
export function mapToRealDpbossDate(istDate: string): string {
  const target = new Date(istDate + "T00:00:00Z");
  const realToday = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  if (target.getTime() <= realToday.getTime()) return istDate;

  const targetDow = target.getUTCDay();
  // Walk backward from realToday until weekday matches.
  const out = new Date(realToday);
  while (out.getUTCDay() !== targetDow) {
    out.setUTCDate(out.getUTCDate() - 1);
  }
  return out.toISOString().slice(0, 10);
}
