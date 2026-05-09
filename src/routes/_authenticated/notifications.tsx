import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore, type NotificationType } from "@/stores/notificationStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, BellOff, CheckCheck, Trash2, Trophy, XCircle, Wallet,
  Megaphone, ArrowDownToLine, ArrowUpToLine, Sparkles, Info,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — SattaKing Pro" }] }),
  component: NotificationsPage,
});

const ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  result_declared: Sparkles,
  bet_won: Trophy,
  bet_lost: XCircle,
  deposit_pending: ArrowDownToLine,
  deposit_approved: ArrowDownToLine,
  deposit_rejected: ArrowDownToLine,
  withdraw_pending: ArrowUpToLine,
  withdraw_approved: ArrowUpToLine,
  withdraw_rejected: ArrowUpToLine,
  broadcast: Megaphone,
  info: Info,
};

const COLORS: Record<NotificationType, string> = {
  result_declared: "text-primary",
  bet_won: "text-emerald-400",
  bet_lost: "text-destructive",
  deposit_pending: "text-amber-400",
  deposit_approved: "text-emerald-400",
  deposit_rejected: "text-destructive",
  withdraw_pending: "text-amber-400",
  withdraw_approved: "text-emerald-400",
  withdraw_rejected: "text-destructive",
  broadcast: "text-secondary",
  info: "text-muted-foreground",
};

const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "UNREAD", label: "Unread" },
  { id: "BETS", label: "Bets" },
  { id: "WALLET", label: "Wallet" },
  { id: "BROADCAST", label: "Broadcasts" },
] as const;

function NotificationsPage() {
  const user = useAuthStore((s) => s.user)!;
  const store = useNotificationStore();
  const items = store.forUser(user.id);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");

  const filtered = useMemo(() => {
    switch (filter) {
      case "UNREAD": return items.filter((i) => !i.read);
      case "BETS": return items.filter((i) => i.type.startsWith("bet_") || i.type === "result_declared");
      case "WALLET": return items.filter((i) => i.type.startsWith("deposit_") || i.type.startsWith("withdraw_"));
      case "BROADCAST": return items.filter((i) => i.type === "broadcast");
      default: return items;
    }
  }, [items, filter]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Result alerts, bet outcomes, wallet updates.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { store.markAllRead(user.id); toast.success("All marked read"); }}>
            <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
          </Button>
          <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => { store.clear(user.id); toast.success("Cleared"); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              filter === f.id ? "bg-primary text-background border-primary" : "border-border/60 text-muted-foreground hover:border-primary/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-xl py-16 text-center">
          <BellOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notifications.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li
                key={n.id}
                onClick={() => store.markRead(n.id)}
                className={`glass rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                  n.read ? "opacity-70" : "border border-primary/30"
                }`}
              >
                <div className={`grid h-9 w-9 place-items-center rounded-full bg-surface ${COLORS[n.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{n.title}</div>
                    {!n.read && <Badge className="bg-primary/20 text-primary text-[10px]">NEW</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  <div className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="text-center">
        <DemoButton userId={user.id} />
      </div>
    </div>
  );
}

function DemoButton({ userId }: { userId: string }) {
  const push = useNotificationStore((s) => s.push);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      onClick={() => {
        push({
          userId, type: "broadcast",
          title: "Welcome bonus boost",
          body: "Get 10% extra on deposits above ₹2,000 today.",
        });
      }}
    >
      <Wallet className="h-3.5 w-3.5 mr-1" /> Add demo notification
    </Button>
  );
}
