import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_MARKETS, seedSampleResults } from "@/lib/seed";
import type { Market, MarketResult } from "@/lib/types";

interface MarketState {
  markets: Market[];
  results: MarketResult[]; // both today & historical
  setMarkets: (m: Market[]) => void;
  upsertResult: (r: MarketResult) => void;
  getTodayResult: (marketId: string) => MarketResult | undefined;
  resetSeed: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useMarketStore = create<MarketState>()(
  persist(
    (set, get) => ({
      markets: SEED_MARKETS,
      results: seedSampleResults(SEED_MARKETS.map((m) => m.id)) as MarketResult[],

      setMarkets: (m) => set({ markets: m }),

      upsertResult: (r) => {
        const others = get().results.filter(
          (x) => !(x.marketId === r.marketId && x.sessionDate === r.sessionDate)
        );
        set({ results: [...others, r] });
      },

      getTodayResult: (marketId) =>
        get().results.find(
          (r) => r.marketId === marketId && r.sessionDate === today()
        ),

      resetSeed: () =>
        set({
          markets: SEED_MARKETS,
          results: seedSampleResults(SEED_MARKETS.map((m) => m.id)) as MarketResult[],
        }),
    }),
    { name: "skp-market" }
  )
);
