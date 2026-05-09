import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import {
  Trophy, Zap, Wallet, ArrowDownToLine, History, FileSearch, Store, Globe,
  Users, TrendingUp, TrendingDown, Activity, AlertTriangle, ArrowRight,
} from "lucide-react";
import { getAdminOverview } from "@/lib/adminDashboard.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

const tiles = [
  { to: "/admin/markets" as const, icon: Store, title: "Markets" },
  { to: "/admin/results/declare" as const, icon: Trophy, title: "Declare" },
  { to: "/admin/results/automation" as const, icon: Zap, title: "Automation" },
  { to: "/admin/results/scrape" as const, icon: Globe, title: "Scraper" },
  { to: "/admin/results/history" as const, icon: History, title: "History" },
  { to: "/admin/results/automation-audit" as const, icon: FileSearch, title: "Audit" },
  { to: "/admin/deposits" as const, icon: Wallet, title: "Deposits" },
  { to: "/admin/withdrawals" as const, icon: ArrowDownToLine, title: "Withdrawals" },
];

const inr = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function AdminHome() {
  const fetchOverview = useServerFn(getAdminOverview);
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 30_000,
  });

  // Realtime invalidation on key tables
  useEffect(() => {
    const ch = supabase
      .channel("admin-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => q.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "market_results" }, () => q.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_requests" }, () => q.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, () => q.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = q.data;
  const k = data?.kpis;
  const health = data?.health;
  const markets = data?.markets ?? [];
  const activity = data?.activity ?? [];

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Live overview · {data?.today ?? "—"} (IST) · auto-refresh 30s
          </p>
        </div>
        {q.isFetching && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3 animate-pulse" /> updating…
          </span>
        )}
      </div>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <Kpi icon={Users} label="Active users today" value={k ? String(k.activeUsers) : "—"} sub={`${k?.newSignups ?? 0} new signups (24h)`} />
        <Kpi icon={Activity} label="Bets placed" value={k ? String(k.bets) : "—"} sub={inr(k?.betVolume ?? 0) + " volume"} />
        <Kpi icon={TrendingDown} label="Gross payout" value={inr(k?.grossPayout ?? 0)} tone="warn" />
        <Kpi icon={TrendingUp} label="House net (today)" value={inr(k?.houseNet ?? 0)} tone={(k?.houseNet ?? 0) >= 0 ? "good" : "warn"} />
        <Kpi icon={Wallet} label="Pending deposits" value={String(k?.pendingDeposits?.count ?? "—")} sub={inr(k?.pendingDeposits?.amount ?? 0)} />
        <Kpi icon={ArrowDownToLine} label="Pending withdrawals" value={String(k?.pendingWithdrawals?.count ?? "—")} sub={inr(k?.pendingWithdrawals?.amount ?? 0)} />
        <Kpi icon={Globe} label="Scraper 24h" value={`${health?.scrapeOk ?? 0} ok`} sub={`${health?.scrapeFail ?? 0} failed · ${timeAgo(health?.scrapeLastRunAt ?? null)}`} />
        <Kpi icon={AlertTriangle} label="Client errors 24h" value={String(health?.clientErrors24h ?? "—")} tone={(health?.clientErrors24h ?? 0) > 0 ? "warn" : "good"} />
      </div>

      <div className="mt-8 grid lg:grid-cols-3 gap-4">
        {/* Today's markets */}
        <div className="lg:col-span-2 rounded-2xl glass-gold p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-bold">Today’s markets</h2>
            <Link to="/admin/results/declare" className="text-xs text-primary hover:underline">Declare →</Link>
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="px-2 py-2 font-medium">Market</th>
                  <th className="px-2 py-2 font-medium">Open</th>
                  <th className="px-2 py-2 font-medium">Close</th>
                  <th className="px-2 py-2 font-medium">Open pana</th>
                  <th className="px-2 py-2 font-medium">Close pana</th>
                  <th className="px-2 py-2 font-medium">Auto</th>
                </tr>
              </thead>
              <tbody>
                {(data?.markets ?? []).map((m) => (
                  <tr key={m.id} className="border-t border-border/40">
                    <td className="px-2 py-2 font-medium">{m.name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{m.openTime}</td>
                    <td className="px-2 py-2 text-muted-foreground">{m.closeTime}</td>
                    <td className="px-2 py-2">
                      {m.openPana ? <span className="font-mono">{m.openPana}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-2">
                      {m.closePana ? <span className="font-mono">{m.closePana}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      <span className={m.autoOpen ? "text-primary" : "text-muted-foreground"}>O</span>
                      {" / "}
                      <span className={m.autoClose ? "text-primary" : "text-muted-foreground"}>C</span>
                    </td>
                  </tr>
                ))}
                {(!data || data.markets.length === 0) && (
                  <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">No active markets.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity feed */}
        <div className="rounded-2xl glass-gold p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold mb-3">Recent activity</h2>
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {(data?.activity ?? []).map((a) => (
              <li key={a.id} className="text-xs border-b border-border/30 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-primary">{a.action}</span>
                  <span className="text-muted-foreground">{timeAgo(a.created_at)}</span>
                </div>
                <div className="text-muted-foreground truncate">
                  {a.market_id ? `${a.market_id} · ` : ""}{a.session ?? ""} {a.pana ?? ""}
                  {a.actor_email ? ` · ${a.actor_email}` : ""}
                </div>
              </li>
            ))}
            {(!data || data.activity.length === 0) && (
              <li className="text-xs text-muted-foreground">No recent activity.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-bold mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group flex items-center justify-between gap-3 rounded-xl glass-gold p-4 hover:ring-gold transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-background shrink-0">
                  <t.icon className="h-4 w-4" />
                </span>
                <span className="font-medium text-sm truncate">{t.title}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ))}
        </div>
      </div>

      {q.error && (
        <p className="mt-6 text-sm text-destructive">Failed to load overview: {(q.error as Error).message}</p>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn";
}) {
  const toneCls =
    tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-foreground";
  return (
    <div className="rounded-xl glass-gold p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 font-display text-2xl font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
