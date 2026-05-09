import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SessionType } from "@/lib/types";

interface DeclareFormState {
  date: string;            // YYYY-MM-DD
  marketId: string | null;
  session: SessionType;
  pana: string;            // up to 3 digits
  setDate: (d: string) => void;
  setMarketId: (id: string | null) => void;
  setSession: (s: SessionType) => void;
  setPana: (p: string) => void;
  prefill: (m: string, s: SessionType) => void;
  reset: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useDeclareForm = create<DeclareFormState>()(
  persist(
    (set) => ({
      date: today(),
      marketId: null,
      session: "OPEN",
      pana: "",
      setDate: (d) => set({ date: d }),
      setMarketId: (id) => set({ marketId: id, pana: "" }),
      setSession: (s) => set({ session: s, pana: "" }),
      setPana: (p) => set({ pana: p.replace(/\D/g, "").slice(0, 3) }),
      prefill: (m, s) => set({ marketId: m, session: s, pana: "" }),
      reset: () => set({ date: today(), marketId: null, session: "OPEN", pana: "" }),
    }),
    {
      name: "skp-declare-form",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : window.sessionStorage
      ),
    }
  )
);
