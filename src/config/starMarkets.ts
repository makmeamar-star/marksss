// The 4 always-on featured markets. Single source of truth used by Home,
// Markets page, the bottom nav star tab, and ResultCard's ★ badge.
export const STAR_MARKET_IDS = [
  "gali",
  "disawar",
  "faridabad",
  "ghaziabad",
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
