import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationType =
  | "result_declared"
  | "bet_won"
  | "bet_lost"
  | "deposit_pending"
  | "deposit_approved"
  | "deposit_rejected"
  | "withdraw_pending"
  | "withdraw_approved"
  | "withdraw_rejected"
  | "broadcast"
  | "info";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  push: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  clear: (userId: string) => void;
  forUser: (userId: string) => AppNotification[];
  unreadCount: (userId: string) => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      push: (n) =>
        set((s) => ({
          notifications: [
            { ...n, id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false },
            ...s.notifications,
          ],
        })),
      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((x) => (x.id === id ? { ...x, read: true } : x)),
        })),
      markAllRead: (userId) =>
        set((s) => ({
          notifications: s.notifications.map((x) =>
            x.userId === userId ? { ...x, read: true } : x
          ),
        })),
      clear: (userId) =>
        set((s) => ({ notifications: s.notifications.filter((x) => x.userId !== userId) })),
      forUser: (userId) => get().notifications.filter((n) => n.userId === userId),
      unreadCount: (userId) =>
        get().notifications.filter((n) => n.userId === userId && !n.read).length,
    }),
    { name: "skp-notifications" }
  )
);
