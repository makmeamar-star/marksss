import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, BellOff, CheckCheck, Trophy, XCircle,
  Megaphone, ArrowDownToLine, ArrowUpToLine, Sparkles, Info,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — SattaKing Pro" }] }),
  component: NotificationsPage,
});

type DbNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: any;
  read_at: string | null;
  created_at: string;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  result_declared: Sparkles,
  bet_won: Trophy,
  bet_lost: XCircle,
  deposit_pending: ArrowDownToLine,
  deposit_approved: ArrowDownToLine,
  deposit_rejected: ArrowDownToLine,
  withdraw_pending: ArrowUpToLine,
  withdraw_approved: ArrowUpToLine,
  withdraw_rejected: ArrowUpToLine,
  admin_credit: ArrowDownToLine,
  admin_debit: ArrowUpToLine,
  broadcast: Megaphone,
  info: Info,
};

const COLORS: Record<string, string> = {
  result_declared: "text-primary",
  bet_won: "text-emerald-400",
  bet_lost: "text-destructive",
  deposit_approved: "text-emerald-400",
  deposit_rejected: "text-destructive",
  withdraw_approved: "text-emerald-400",
  withdraw_rejected: "text-destructive",
  admin_credit: "text-emerald-400",
  admin_debit: "text-destructive",
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
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as DbNotification[];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user.id, qc]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "UNREAD": return items.filter((i) => !i.read_at);
      case "BETS": return items.filter((i) => i.type.startsWith("bet_") || i.type === "result_declared");
      case "WALLET": return items.filter((i) =>
        i.type.startsWith("deposit_") || i.type.startsWith("withdraw_") || i.type.startsWith("admin_"));
      case "BROADCAST": return items.filter((i) => i.type === "broadcast");
      default: return items;
    }
  }, [items, filter]);

  async function markRead(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  }

  async function markAllRead() {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) return toast.error(error.message);
    toast.success("All marked read");
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Result alerts, bet outcomes, wallet updates.</p>
        </div>
        <Button size="sm" variant="outline" onClick={markAllRead}>
          <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
        </Button>
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

      {isLoading ? (
        <div className="glass rounded-xl py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl py-16 text-center">
          <BellOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notifications.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const color = COLORS[n.type] ?? "text-muted-foreground";
            const read = !!n.read_at;
            return (
              <li
                key={n.id}
                onClick={() => !read && markRead(n.id)}
                className={`glass rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                  read ? "opacity-70" : "border border-primary/30"
                }`}
              >
                <div className={`grid h-9 w-9 place-items-center rounded-full bg-surface ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{n.title}</div>
                    {!read && <Badge className="bg-primary/20 text-primary text-[10px]">NEW</Badge>}
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                  <div className="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
