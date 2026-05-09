import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Bet, BetType, Market, SessionType, Transaction } from "@/lib/types";
import { payoutFor } from "@/lib/settlement";
import { useAuthStore } from "./authStore";

export interface PendingBet {
  id: string;          // local slip id
  marketId: string;
  marketName: string;
  session: SessionType;
  betType: BetType;
  betNumber: string;
  amount: number;
  payout: number;
}

interface BetState {
  slip: PendingBet[];
  bets: Bet[];
  transactions: Transaction[];

  addToSlip: (b: Omit<PendingBet, "id">) => void;
  removeFromSlip: (id: string) => void;
  clearSlip: () => void;

  placeAll: () => { ok: boolean; error?: string; placed: number };

  betsForUser: (userId: string) => Bet[];
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export const useBetStore = create<BetState>()(
  persist(
    (set, get) => ({
      slip: [],
      bets: [],
      transactions: [],

      addToSlip: (b) =>
        set((s) => ({
          slip: [...s.slip, { ...b, id: crypto.randomUUID() }],
        })),

      removeFromSlip: (id) =>
        set((s) => ({ slip: s.slip.filter((x) => x.id !== id) })),

      clearSlip: () => set({ slip: [] }),

      placeAll: () => {
        const slip = get().slip;
        if (slip.length === 0) return { ok: false, error: "Bet slip is empty", placed: 0 };

        const auth = useAuthStore.getState();
        const user = auth.user;
        if (!user) return { ok: false, error: "Please login first", placed: 0 };

        const total = slip.reduce((s, x) => s + x.amount, 0);
        if (user.balance < total) {
          return { ok: false, error: `Insufficient balance. Need ₹${total.toFixed(2)}`, placed: 0 };
        }

        const now = new Date().toISOString();
        const placed: Bet[] = slip.map((p) => ({
          id: crypto.randomUUID(),
          userId: user.id,
          marketId: p.marketId,
          sessionDate: todayStr(),
          session: p.session,
          betType: p.betType,
          betNumber: p.betNumber,
          amount: p.amount,
          payout: p.payout,
          status: "PENDING",
          createdAt: now,
        }));

        const txns: Transaction[] = slip.map((p) => ({
          id: crypto.randomUUID(),
          userId: user.id,
          type: "BET_PLACED",
          amount: p.amount,
          balanceBefore: 0, // filled below per-bet
          balanceAfter: 0,
          status: "COMPLETED",
          description: `${p.marketName} · ${p.betType} · ${p.betNumber}`,
          createdAt: now,
        }));

        let bal = user.balance;
        txns.forEach((t, i) => {
          t.balanceBefore = bal;
          bal -= slip[i].amount;
          t.balanceAfter = bal;
        });

        auth.setBalance(bal);
        auth.bumpStats({ totalBet: total });

        set((s) => ({
          bets: [...placed, ...s.bets],
          transactions: [...txns, ...s.transactions],
          slip: [],
        }));

        return { ok: true, placed: placed.length };
      },

      betsForUser: (userId) => get().bets.filter((b) => b.userId === userId),
    }),
    { name: "skp-bets" }
  )
);

export function quickPayout(market: Market, betType: BetType): number {
  return payoutFor(market, betType);
}
