import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionType } from "@/lib/types";

export type AuditAction = "DECLARED" | "CORRECTED" | "CANCELLED";

export interface AuditEntry {
  id: string;
  ts: string;
  adminId: string;
  adminEmail: string;
  action: AuditAction;
  marketId: string;
  marketName: string;
  session: SessionType;
  sessionDate: string;
  oldPana?: string;
  newPana?: string;
  reason?: string;
  betsAffected: number;
  payout: number;
}

interface AuditState {
  entries: AuditEntry[];
  push: (e: Omit<AuditEntry, "id" | "ts">) => void;
  forDays: (days: number) => AuditEntry[];
  clear: () => void;
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set, get) => ({
      entries: [],
      push: (e) =>
        set((s) => ({
          entries: [
            { ...e, id: crypto.randomUUID(), ts: new Date().toISOString() },
            ...s.entries,
          ].slice(0, 500),
        })),
      forDays: (days) => {
        const cutoff = Date.now() - days * 86_400_000;
        return get().entries.filter((e) => new Date(e.ts).getTime() >= cutoff);
      },
      clear: () => set({ entries: [] }),
    }),
    { name: "skp-audit" }
  )
);
