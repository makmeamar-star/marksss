// Pure-TypeScript settlement engine for Matka bets.
// Designed to be portable directly into a Node/Express/Prisma backend —
// the function signatures stay identical when ported.

import { digitFromPana, panaType } from "./panaChart";
import type { Bet, BetType, Market } from "./types";

export interface ResultInput {
  openPana?: string;
  closePana?: string;
}

export interface ResolvedResult {
  openPana?: string;
  openDigit?: number;
  closePana?: string;
  closeDigit?: number;
  jodi?: string;
}

/** Resolve digits + jodi from declared panas. */
export function resolveResult(input: ResultInput): ResolvedResult {
  const out: ResolvedResult = {};
  if (input.openPana) {
    out.openPana = input.openPana;
    out.openDigit = digitFromPana(input.openPana);
  }
  if (input.closePana) {
    out.closePana = input.closePana;
    out.closeDigit = digitFromPana(input.closePana);
  }
  if (out.openDigit !== undefined && out.closeDigit !== undefined) {
    out.jodi = `${out.openDigit}${out.closeDigit}`;
  }
  return out;
}

/** Decide if a single bet wins given the resolved result. */
export function evaluateBet(bet: Bet, r: ResolvedResult): boolean {
  switch (bet.betType) {
    case "SINGLE_OPEN":
      return r.openDigit !== undefined && bet.betNumber === String(r.openDigit);
    case "SINGLE_CLOSE":
      return r.closeDigit !== undefined && bet.betNumber === String(r.closeDigit);
    case "JODI":
      return !!r.jodi && bet.betNumber === r.jodi;
    case "SINGLE_PANA":
      return (
        (bet.session === "OPEN" && bet.betNumber === r.openPana && panaType(bet.betNumber) === "SINGLE") ||
        (bet.session === "CLOSE" && bet.betNumber === r.closePana && panaType(bet.betNumber) === "SINGLE")
      );
    case "DOUBLE_PANA":
      return (
        (bet.session === "OPEN" && bet.betNumber === r.openPana && panaType(bet.betNumber) === "DOUBLE") ||
        (bet.session === "CLOSE" && bet.betNumber === r.closePana && panaType(bet.betNumber) === "DOUBLE")
      );
    case "TRIPLE_PANA":
      return (
        (bet.session === "OPEN" && bet.betNumber === r.openPana && panaType(bet.betNumber) === "TRIPLE") ||
        (bet.session === "CLOSE" && bet.betNumber === r.closePana && panaType(bet.betNumber) === "TRIPLE")
      );
    case "HALF_SANGAM": {
      // Format: "openDigit-closePana" OR "openPana-closeDigit"
      const [a, b] = bet.betNumber.split("-");
      if (!a || !b) return false;
      if (a.length === 1 && b.length === 3)
        return r.openDigit === Number(a) && r.closePana === b;
      if (a.length === 3 && b.length === 1)
        return r.openPana === a && r.closeDigit === Number(b);
      return false;
    }
    case "FULL_SANGAM": {
      // Format: "openPana-closePana"
      const [a, b] = bet.betNumber.split("-");
      return a === r.openPana && b === r.closePana;
    }
  }
}

export interface SettlementResult {
  settled: Array<Bet & { winAmount: number }>;
  totalBet: number;
  totalPayout: number;
  netImpact: number; // +ve = house profit
  winnersCount: number;
  losersCount: number;
}

export function settleBets(bets: Bet[], result: ResolvedResult): SettlementResult {
  let totalBet = 0;
  let totalPayout = 0;
  let winnersCount = 0;
  let losersCount = 0;

  const settled = bets.map((b) => {
    totalBet += b.amount;
    const won = evaluateBet(b, result);
    const winAmount = won ? Number((b.amount * b.payout).toFixed(2)) : 0;
    if (won) {
      totalPayout += winAmount;
      winnersCount++;
    } else {
      losersCount++;
    }
    return {
      ...b,
      status: (won ? "WON" : "LOST") as Bet["status"],
      winAmount,
      settledAt: new Date().toISOString(),
    };
  });

  return {
    settled,
    totalBet,
    totalPayout,
    netImpact: totalBet - totalPayout,
    winnersCount,
    losersCount,
  };
}

/** Resolve payout multiplier for a (market, betType) pair. */
export function payoutFor(market: Market, betType: BetType): number {
  const p = market.payouts;
  switch (betType) {
    case "SINGLE_OPEN":
    case "SINGLE_CLOSE": return p.single;
    case "JODI": return p.jodi;
    case "SINGLE_PANA": return p.singlePana;
    case "DOUBLE_PANA": return p.doublePana;
    case "TRIPLE_PANA": return p.triplePana;
    case "HALF_SANGAM": return p.halfSangam;
    case "FULL_SANGAM": return p.fullSangam;
  }
}
