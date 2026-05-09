// Server-only re-export of the pure settlement engine.
// settlement.ts and panaChart.ts contain no browser APIs and no Zustand
// imports, so they're safe to call from createServerFn handlers. Giving
// the file a `.server.ts` extension hard-locks it out of client bundles
// per TanStack Start's import protection.

export {
  resolveResult,
  evaluateBet,
  settleBets,
  payoutFor,
  type ResultInput,
  type ResolvedResult,
  type SettlementResult,
} from "./settlement";

export {
  isValidPana,
  digitFromPana,
  panaType,
  getSuggestedPanas,
  type PanaType,
} from "./panaChart";
