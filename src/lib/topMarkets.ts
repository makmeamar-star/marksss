// Core markets: surfaced on Home, Star and "top" lists. The runtime source
// of truth is `markets.is_core` (admin toggle in Admin → Markets). The
// hardcoded list below is a build-time fallback so the UI still renders
// the curated set before the DB has loaded — or if every row has is_core
// false for some reason.
export const TOP_MARKET_IDS = [
  "kalyan",
  "kalyan_night",
  "milan_day",
  "milan_night",
  "rajdhani_day",
  "rajdhani_night",
  "main_bazar",
  "main_mumbai",
  "time_bazar",
  "sridevi",
  "sridevi_night",
  "madhur_day",
  "madhur_night",
  "kalyan_morning",
  "super_kalyan",
] as const;

const FALLBACK_SET = new Set<string>(TOP_MARKET_IDS);

type Coreable = { id: string; isCore?: boolean };

function coreIdSet<T extends Coreable>(all: T[]): Set<string> {
  const fromFlag = all.filter((m) => m.isCore).map((m) => m.id);
  if (fromFlag.length > 0) return new Set(fromFlag);
  return FALLBACK_SET;
}

export function splitTopMarkets<T extends Coreable>(all: T[]): {
  top: T[];
  rest: T[];
} {
  const core = coreIdSet(all);
  // Preserve curated order when falling back to TOP_MARKET_IDS, otherwise
  // preserve the input order (typically alphabetical).
  if (core === FALLBACK_SET) {
    const byId = new Map(all.map((m) => [m.id, m] as const));
    const top = TOP_MARKET_IDS
      .map((id) => byId.get(id))
      .filter((m): m is T => Boolean(m));
    const rest = all.filter((m) => !FALLBACK_SET.has(m.id));
    return { top, rest };
  }
  const top = all.filter((m) => core.has(m.id));
  const rest = all.filter((m) => !core.has(m.id));
  return { top, rest };
}

export function isTopMarket(id: string): boolean {
  // Synchronous helper — uses the static fallback list. Components that
  // need DB-accurate answers should use splitTopMarkets on the loaded
  // markets array instead.
  return FALLBACK_SET.has(id);
}

// Sort helper: top-first, then everything else preserving the input order.
export function sortTopFirst<T extends Coreable>(all: T[]): T[] {
  const { top, rest } = splitTopMarkets(all);
  return [...top, ...rest];
}
