// Featured "Star Markets" pinned across Home, /star, /markets sticky bar and
// the bottom nav star tab. Curated order shown to users.
export const STAR_MARKET_IDS = [
  // Delhi (jodi-only)
  "gali",
  "disawar",
  "faridabad",
  "ghaziabad",
  // Mumbai mains
  "kalyan",
  "kalyan_night",
  "main_bazar",
  "main_mumbai",
  "milan_day",
  "milan_night",
  "rajdhani_day",
  "rajdhani_night",
  "sridevi",
  "sridevi_night",
  "time_bazar",
  "madhur_day",
  "madhur_night",
] as const;

export type StarMarketId = (typeof STAR_MARKET_IDS)[number];

const STAR_SET = new Set<string>(STAR_MARKET_IDS);

export function isStarMarket(id: string): boolean {
  return STAR_SET.has(id);
}

export function pickStarMarkets<T extends { id: string }>(all: T[]): T[] {
  const byId = new Map(all.map((m) => [m.id, m] as const));
  return STAR_MARKET_IDS.map((id) => byId.get(id)).filter((m): m is T => Boolean(m));
}
