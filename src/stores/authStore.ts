import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { AppUser, Role } from "@/lib/types";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  hydrated: boolean;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  bootstrap: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<AppUser>;
  register: (input: { username: string; email: string; phone?: string; password: string }) => Promise<AppUser>;
  logout: () => Promise<void>;
  // legacy compat — local state only; server is source of truth.
  setBalance: (next: number) => void;
  bumpStats: (delta: Partial<Pick<AppUser, "totalBet" | "totalWin" | "totalDeposit" | "totalWithdraw">>) => void;
}

const refCode = (id: string) => id.replace(/-/g, "").slice(0, 6).toUpperCase();

async function loadUserFor(userId: string, fallbackEmail: string | null): Promise<AppUser | null> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!profile) return null;
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  const role: Role = isAdmin ? "ADMIN" : "USER";
  return {
    id: userId,
    username: profile.username,
    email: profile.email ?? fallbackEmail ?? "",
    phone: profile.phone ?? undefined,
    role,
    status: "ACTIVE",
    balance: Number(profile.balance ?? 0),
    totalDeposit: Number(profile.total_deposit ?? 0),
    totalWithdraw: Number(profile.total_withdraw ?? 0),
    totalBet: Number(profile.total_bet ?? 0),
    totalWin: Number(profile.total_win ?? 0),
    referralCode: refCode(userId),
    createdAt: profile.created_at,
  };
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  loading: false,
  hydrated: false,

  isAuthenticated: () => !!get().user,
  isAdmin: () => {
    const r = get().user?.role;
    return r === "ADMIN" || r === "SUPER_ADMIN";
  },

  bootstrap: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session) {
      const u = await loadUserFor(session.user.id, session.user.email ?? null);
      set({ user: u, hydrated: true });
    } else {
      set({ user: null, hydrated: true });
    }
    supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (sess) {
        const u = await loadUserFor(sess.user.id, sess.user.email ?? null);
        set({ user: u });
      } else {
        set({ user: null });
      }
    });
  },

  refreshProfile: async () => {
    const u = get().user;
    if (!u) return;
    const fresh = await loadUserFor(u.id, u.email);
    if (fresh) set({ user: fresh });
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new Error(error?.message ?? "Login failed");
      const u = await loadUserFor(data.user.id, data.user.email ?? null);
      if (!u) throw new Error("Profile not found");
      set({ user: u });
      return u;
    } finally {
      set({ loading: false });
    }
  },

  register: async ({ username, email, phone, password }) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { username, phone },
        },
      });
      if (error || !data.user) throw new Error(error?.message ?? "Sign up failed");
      // Trigger creates profile + role. Allow a brief moment, then load.
      await new Promise((r) => setTimeout(r, 400));
      const u = await loadUserFor(data.user.id, data.user.email ?? null);
      if (!u) throw new Error("Profile creation pending — try logging in.");
      set({ user: u });
      return u;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },

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
}));
