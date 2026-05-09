import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Transaction, TransactionType } from "@/lib/types";
import { useAuthStore } from "./authStore";
import { useNotificationStore } from "./notificationStore";

export interface BankAccount {
  id: string;
  userId: string;
  holderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  createdAt: string;
}
export interface UpiId {
  id: string;
  userId: string;
  upi: string;
  label?: string;
  createdAt: string;
}

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export interface DepositRequest {
  id: string;
  userId: string;
  amount: number;
  method: "UPI" | "BANK" | "QR";
  reference?: string;
  status: RequestStatus;
  createdAt: string;
  resolvedAt?: string;
  note?: string;
}
export interface WithdrawRequest {
  id: string;
  userId: string;
  amount: number;
  destinationType: "UPI" | "BANK";
  destinationId: string;
  destinationLabel: string;
  status: RequestStatus;
  createdAt: string;
  resolvedAt?: string;
  note?: string;
}

interface WalletState {
  transactions: Transaction[];
  deposits: DepositRequest[];
  withdraws: WithdrawRequest[];
  banks: BankAccount[];
  upis: UpiId[];

  pushTransaction: (t: Omit<Transaction, "id" | "createdAt">) => void;
  requestDeposit: (input: { amount: number; method: DepositRequest["method"]; reference?: string }) => { ok: boolean; error?: string };
  requestWithdraw: (input: { amount: number; destinationType: "UPI" | "BANK"; destinationId: string; destinationLabel: string }) => { ok: boolean; error?: string };
  approveDeposit: (id: string, note?: string) => void;
  rejectDeposit: (id: string, note?: string) => void;
  approveWithdraw: (id: string, note?: string) => void;
  rejectWithdraw: (id: string, note?: string) => void;

  addBank: (b: Omit<BankAccount, "id" | "createdAt">) => void;
  removeBank: (id: string) => void;
  addUpi: (u: Omit<UpiId, "id" | "createdAt">) => void;
  removeUpi: (id: string) => void;

  transactionsForUser: (userId: string) => Transaction[];
}

const now = () => new Date().toISOString();

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      transactions: [],
      deposits: [],
      withdraws: [],
      banks: [],
      upis: [],

      pushTransaction: (t) =>
        set((s) => ({
          transactions: [{ ...t, id: crypto.randomUUID(), createdAt: now() }, ...s.transactions],
        })),

      requestDeposit: ({ amount, method, reference }) => {
        const u = useAuthStore.getState().user;
        if (!u) return { ok: false, error: "Login required" };
        if (amount < 100) return { ok: false, error: "Minimum deposit is ₹100" };
        if (amount > 100000) return { ok: false, error: "Maximum deposit is ₹1,00,000" };
        const dep: DepositRequest = {
          id: crypto.randomUUID(),
          userId: u.id,
          amount,
          method,
          reference,
          status: "PENDING",
          createdAt: now(),
        };
        set((s) => ({ deposits: [dep, ...s.deposits] }));
        get().pushTransaction({
          userId: u.id,
          type: "DEPOSIT",
          amount,
          balanceBefore: u.balance,
          balanceAfter: u.balance,
          status: "PENDING",
          description: `Deposit request via ${method}${reference ? ` (ref ${reference})` : ""}`,
        });
        useNotificationStore.getState().push({
          userId: u.id,
          type: "deposit_pending",
          title: "Deposit submitted",
          body: `Your ₹${amount} deposit is pending admin approval.`,
        });
        return { ok: true };
      },

      requestWithdraw: ({ amount, destinationType, destinationId, destinationLabel }) => {
        const auth = useAuthStore.getState();
        const u = auth.user;
        if (!u) return { ok: false, error: "Login required" };
        if (amount < 500) return { ok: false, error: "Minimum withdrawal is ₹500" };
        if (amount > u.balance) return { ok: false, error: "Insufficient balance" };
        const w: WithdrawRequest = {
          id: crypto.randomUUID(),
          userId: u.id,
          amount,
          destinationType,
          destinationId,
          destinationLabel,
          status: "PENDING",
          createdAt: now(),
        };
        // hold the funds
        const next = u.balance - amount;
        auth.setBalance(next);
        set((s) => ({ withdraws: [w, ...s.withdraws] }));
        get().pushTransaction({
          userId: u.id,
          type: "WITHDRAWAL",
          amount,
          balanceBefore: u.balance,
          balanceAfter: next,
          status: "PENDING",
          description: `Withdraw to ${destinationLabel}`,
        });
        useNotificationStore.getState().push({
          userId: u.id,
          type: "withdraw_pending",
          title: "Withdrawal submitted",
          body: `Your ₹${amount} withdrawal is pending admin approval.`,
        });
        return { ok: true };
      },

      approveDeposit: (id, note) => {
        const dep = get().deposits.find((d) => d.id === id);
        if (!dep || dep.status !== "PENDING") return;
        const auth = useAuthStore.getState();
        const u = auth.user;
        if (u && u.id === dep.userId) {
          const next = u.balance + dep.amount;
          auth.setBalance(next);
          auth.bumpStats({ totalDeposit: dep.amount });
        }
        set((s) => ({
          deposits: s.deposits.map((d) =>
            d.id === id ? { ...d, status: "APPROVED", resolvedAt: now(), note } : d
          ),
        }));
        get().pushTransaction({
          userId: dep.userId,
          type: "DEPOSIT",
          amount: dep.amount,
          balanceBefore: u?.balance ?? 0,
          balanceAfter: (u?.balance ?? 0) + dep.amount,
          status: "COMPLETED",
          description: `Deposit approved (${dep.method})`,
        });
        useNotificationStore.getState().push({
          userId: dep.userId,
          type: "deposit_approved",
          title: "Deposit approved",
          body: `₹${dep.amount} credited to your wallet.`,
        });
      },

      rejectDeposit: (id, note) => {
        set((s) => ({
          deposits: s.deposits.map((d) =>
            d.id === id ? { ...d, status: "REJECTED", resolvedAt: now(), note } : d
          ),
        }));
      },

      approveWithdraw: (id, note) => {
        const w = get().withdraws.find((x) => x.id === id);
        if (!w || w.status !== "PENDING") return;
        const auth = useAuthStore.getState();
        if (auth.user?.id === w.userId) auth.bumpStats({ totalWithdraw: w.amount });
        set((s) => ({
          withdraws: s.withdraws.map((x) =>
            x.id === id ? { ...x, status: "APPROVED", resolvedAt: now(), note } : x
          ),
        }));
        useNotificationStore.getState().push({
          userId: w.userId,
          type: "withdraw_approved",
          title: "Withdrawal approved",
          body: `₹${w.amount} sent to ${w.destinationLabel}.`,
        });
      },

      rejectWithdraw: (id, note) => {
        const w = get().withdraws.find((x) => x.id === id);
        if (!w || w.status !== "PENDING") return;
        // refund hold
        const auth = useAuthStore.getState();
        if (auth.user?.id === w.userId) {
          auth.setBalance(auth.user.balance + w.amount);
        }
        set((s) => ({
          withdraws: s.withdraws.map((x) =>
            x.id === id ? { ...x, status: "REJECTED", resolvedAt: now(), note } : x
          ),
        }));
      },

      addBank: (b) =>
        set((s) => ({ banks: [{ ...b, id: crypto.randomUUID(), createdAt: now() }, ...s.banks] })),
      removeBank: (id) => set((s) => ({ banks: s.banks.filter((b) => b.id !== id) })),
      addUpi: (u) =>
        set((s) => ({ upis: [{ ...u, id: crypto.randomUUID(), createdAt: now() }, ...s.upis] })),
      removeUpi: (id) => set((s) => ({ upis: s.upis.filter((u) => u.id !== id) })),

      transactionsForUser: (userId) => get().transactions.filter((t) => t.userId === userId),
    }),
    { name: "skp-wallet" }
  )
);

export const TX_LABEL: Record<TransactionType, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  BET_PLACED: "Bet placed",
  BET_WIN: "Bet win",
  BET_REFUND: "Bet refund",
  BONUS: "Bonus",
  REFERRAL_BONUS: "Referral bonus",
  ADMIN_CREDIT: "Admin credit",
  ADMIN_DEBIT: "Admin debit",
};
