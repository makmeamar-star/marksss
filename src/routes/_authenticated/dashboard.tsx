import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Wallet, Receipt, Trophy, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/authStore";
import { useMarkets, useMyBets, useResultsForDate, useLatestResultsPerMarket, useLiveAcceptingMarkets } from "@/hooks/useGameData";
import { todayIST } from "@/lib/marketTime";
import { ResultCard } from "@/components/ResultCard";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SattaKing Pro" }] }),
  component: Dashboard,
});

function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  useEffect(() => { if (user?.id) void refreshProfile(); }, [user?.id, refreshProfile]);
  const today = todayIST();
  const { data: bets = [] } = useMyBets();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  const { data: latestPerMarket = {}, isLoading: prevLoading, isError: prevError, refetch: refetchPrev } = useLatestResultsPerMarket();

  const userBets = bets;
  const todayBets = userBets.filter((b) => b.sessionDate === today);
  const wonToday = todayBets.filter((b) => b.status === "WON");
  const pending = userBets.filter((b) => b.status === "PENDING");

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      {/* Welcome */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            Welcome back, <span className="text-primary text-glow-gold">{user?.username}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here's what's happening today.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
            <Link to="/wallet">Add Funds</Link>
          </Button>
          <Button asChild variant="outline" className="border-saffron/50 text-saffron hover:bg-saffron/10">
            <Link to="/rewards">Daily Rewards</Link>
          </Button>
          <Button asChild className="bg-gradient-gold text-background font-bold hover:opacity-90">
            <Link to="/markets">Place a Bet <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Balance"
          value={hydrated && user ? `₹${(user.balance ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
          icon={<Wallet />} accent
        />
        <Kpi
          label="Bets Today"
          value={String(todayBets.length)}
          sub={`₹${todayBets.reduce((s, b) => s + b.amount, 0).toLocaleString("en-IN")}`}
          icon={<Receipt />}
        />
        <Kpi
          label="Won Today"
          value={String(wonToday.length)}
          sub={`₹${wonToday.reduce((s, b) => s + (b.winAmount ?? 0), 0).toLocaleString("en-IN")}`}
          icon={<Trophy />}
          tone="success"
        />
        <Kpi
          label="Pending"
          value={String(pending.length)}
          icon={<Clock />}
        />
      </div>

      {/* Markets accepting bets right now */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl font-bold">Markets accepting bets now</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Open & close sessions still live — sorted by closest cutoff.</p>
          </div>
          <Link to="/markets" className="text-sm text-primary hover:underline">View all →</Link>
        </div>
        {accepting.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center text-muted-foreground">
            No markets are accepting bets right now. <Link to="/markets" className="text-primary hover:underline">Browse all markets →</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accepting.slice(0, 6).map((m) => (
              <div key={m.id} className="space-y-2">
                <ResultCard market={m} result={results.find((r) => r.marketId === m.id && r.sessionDate === today)} previousResult={latestPerMarket[m.id]} showPreviousFallback previousLoading={prevLoading} previousError={prevError} onRetryPrevious={() => refetchPrev()} />
                <Button asChild size="sm" className="w-full h-8 text-xs bg-gradient-gold text-background font-bold hover:opacity-90">
                  <Link to="/bet/$marketId" params={{ marketId: m.id }} preload="intent">Bet Now</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>


      {/* Today bets */}
      <section>
        <h2 className="font-display text-2xl font-bold mb-4">Today's Bets</h2>
        <div className="glass rounded-xl overflow-hidden">
          {todayBets.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              No bets yet today. <Link to="/markets" className="text-primary hover:underline">Place your first bet.</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface/60 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 text-xs uppercase tracking-wider">Market</th>
                    <th className="px-4 py-2.5 text-xs uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2.5 text-xs uppercase tracking-wider">Number</th>
                    <th className="px-4 py-2.5 text-xs uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-2.5 text-xs uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-xs uppercase tracking-wider">Win</th>
                  </tr>
                </thead>
                <tbody>
                  {todayBets.map((b) => {
                    const market = markets.find((m) => m.id === b.marketId);
                    return (
                      <tr key={b.id} className="border-t border-border/50">
                        <td className="px-4 py-2.5">{market?.displayName ?? b.marketId}</td>
                        <td className="px-4 py-2.5 text-xs">{b.betType}</td>
                        <td className="px-4 py-2.5 font-mono text-primary">{b.betNumber}</td>
                        <td className="px-4 py-2.5 font-mono">₹{b.amount}</td>
                        <td className="px-4 py-2.5">
                          <BetBadge status={b.status} />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-success">
                          {b.winAmount ? `₹${b.winAmount.toLocaleString("en-IN")}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, icon, accent, tone }: { label: string; value: string; sub?: string; icon: React.ReactNode; accent?: boolean; tone?: "success" }) {
  return (
    <div className={`glass rounded-xl p-4 ${accent ? "ring-gold" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className={`font-display text-2xl md:text-3xl font-bold mt-1 ${accent ? "text-primary text-glow-gold" : tone === "success" ? "text-success" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function BetBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-warning/15 text-warning border-warning/40",
    WON: "bg-success/15 text-success border-success/40",
    LOST: "bg-danger/15 text-danger border-danger/40",
    CANCELLED: "bg-muted text-muted-foreground",
    REFUNDED: "bg-secondary/15 text-secondary border-secondary/40",
  };
  return <Badge className={`${map[status] ?? ""} font-mono text-[10px]`}>{status}</Badge>;
}
