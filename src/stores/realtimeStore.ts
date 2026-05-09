import { create } from "zustand";

export type ActivityKind =
  | "result:declared"
  | "result:corrected"
  | "settlement:complete"
  | "bet:settlement:batch"
  | "market:status:changed"
  | "notification:sent"
  | "user:win";

export interface ActivityEvent {
  id: string;
  ts: string;
  kind: ActivityKind;
  message: string;
  meta?: Record<string, unknown>;
}

interface RealtimeState {
  events: ActivityEvent[];
  emit: (kind: ActivityKind, message: string, meta?: Record<string, unknown>) => void;
  clear: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  events: [],
  emit: (kind, message, meta) =>
    set((s) => ({
      events: [
        { id: crypto.randomUUID(), ts: new Date().toISOString(), kind, message, meta },
        ...s.events,
      ].slice(0, 50),
    })),
  clear: () => set({ events: [] }),
}));
