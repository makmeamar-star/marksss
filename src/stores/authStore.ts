import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppUser, Role } from "@/lib/types";

interface AuthState {
  user: AppUser | null;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  login: (identifier: string, role?: Role) => AppUser;
  register: (input: { username: string; email: string; phone?: string }) => AppUser;
  logout: () => void;
  setBalance: (next: number) => void;
  bumpStats: (delta: Partial<Pick<AppUser, "totalBet" | "totalWin" | "totalDeposit" | "totalWithdraw">>) => void;
}

const code = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase();

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,

      isAuthenticated: () => !!get().user,
      isAdmin: () => {
        const r = get().user?.role;
        return r === "ADMIN" || r === "SUPER_ADMIN";
      },

      login: (identifier, role = "USER") => {
        const existing = get().user;
        if (existing && existing.username === identifier) return existing;
        const u: AppUser = existing ?? {
          id: crypto.randomUUID(),
          username: identifier || "player",
          email: `${identifier || "player"}@demo.local`,
          role,
          status: "ACTIVE",
          balance: 5000,
          totalDeposit: 5000,
          totalWithdraw: 0,
          totalBet: 0,
          totalWin: 0,
          referralCode: code(),
          createdAt: new Date().toISOString(),
        };
        // allow promoting role on demo
        const next = { ...u, role };
        set({ user: next });
        return next;
      },

      register: ({ username, email, phone }) => {
        const u: AppUser = {
          id: crypto.randomUUID(),
          username,
          email,
          phone,
          role: "USER",
          status: "ACTIVE",
          balance: 1000, // welcome bonus
          totalDeposit: 1000,
          totalWithdraw: 0,
          totalBet: 0,
          totalWin: 0,
          referralCode: code(),
          createdAt: new Date().toISOString(),
        };
        set({ user: u });
        return u;
      },

      logout: () => set({ user: null }),

      setBalance: (next) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, balance: Number(next.toFixed(2)) } });
      },

      bumpStats: (delta) => {
        const u = get().user;
        if (!u) return;
        set({
          user: {
            ...u,
            totalBet: (u.totalBet ?? 0) + (delta.totalBet ?? 0),
            totalWin: (u.totalWin ?? 0) + (delta.totalWin ?? 0),
            totalDeposit: (u.totalDeposit ?? 0) + (delta.totalDeposit ?? 0),
            totalWithdraw: (u.totalWithdraw ?? 0) + (delta.totalWithdraw ?? 0),
          },
        });
      },
    }),
    { name: "skp-auth" }
  )
);
