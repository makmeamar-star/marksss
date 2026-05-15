// Curated top-15 markets surfaced by default. Other markets remain available
// behind a "Show all" expander on listing pages.
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

const TOP_SET = new Set<string>(TOP_MARKET_IDS);

export function splitTopMarkets<T extends { id: string }>(all: T[]): {
  top: T[];
  rest: T[];
} {
  const byId = new Map(all.map((m) => [m.id, m] as const));
  const top = TOP_MARKET_IDS
    .map((id) => byId.get(id))
    .filter((m): m is T => Boolean(m));
  const rest = all.filter((m) => !TOP_SET.has(m.id));
  return { top, rest };
}

export function isTopMarket(id: string): boolean {
  return TOP_SET.has(id);
}

// Sort helper: top-15 first (in curated order), then everything else preserving
// the input order (typically alphabetical from the loader).
export function sortTopFirst<T extends { id: string }>(all: T[]): T[] {
  const { top, rest } = splitTopMarkets(all);
  return [...top, ...rest];
}
