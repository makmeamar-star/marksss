import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Trophy, TrendingUp, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResultsTicker } from "@/components/ResultsTicker";
import { ResultCard } from "@/components/ResultCard";
import { useMarketStore } from "@/stores/marketStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SattaKing Pro — India's Most Trusted Matka Platform" },
      { name: "description", content: "Live Matka results, instant settlements, and a beautifully crafted betting experience. Play smart. Win big." },
      { property: "og:title", content: "SattaKing Pro — Trusted Matka Platform" },
      { property: "og:description", content: "Live Matka results & instant settlements." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const markets = useMarketStore((s) => s.markets);
  const results = useMarketStore((s) => s.results);
  const today = new Date().toISOString().slice(0, 10);

  const declaredToday = results.filter((r) => r.sessionDate === today && r.status === "DECLARED").length;
  const openNow = markets.filter((m) => m.isOpen).length;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <ResultsTicker />

      {/* HERO */}
      <section className="relative overflow-hidden bg-radial-spotlight">
        <div className="absolute inset-0 particles-bg opacity-40 pointer-events-none" />
        <div className="container mx-auto px-4 py-20 md:py-28 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Live Now
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-bold mt-6 leading-tight">
              India's Most Trusted
              <br />
              <span className="bg-gradient-gold bg-clip-text text-transparent text-glow-gold">
                Matka Platform
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto">
              Play smart. Win big. Instant results across every major market — Kalyan, Main Mumbai, Milan, Rajdhani and more.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <Button asChild size="lg" className="bg-gradient-gold text-background font-bold shadow-[0_0_40px_-8px_var(--primary)] hover:opacity-90">
                <Link to="/register">Play Now <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
                <Link to="/results">View Results</Link>
              </Button>
            </div>

            {/* Live counters */}
            <div className="grid grid-cols-3 gap-4 mt-14 max-w-xl mx-auto">
              <Stat icon={<Users className="h-4 w-4" />} label="Active Players" value="48,219" />
              <Stat icon={<Trophy className="h-4 w-4" />} label="Today's Winners" value="1,847" />
              <Stat icon={<TrendingUp className="h-4 w-4" />} label="Markets" value={String(markets.length)} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* LIVE RESULTS */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Today's Live Results</h2>
            <p className="text-muted-foreground mt-1">Auto-refreshing every 30 seconds</p>
          </div>
          <Link to="/results" className="hidden sm:inline-flex items-center gap-1 text-sm text-primary hover:underline">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {markets.map((m) => (
            <ResultCard key={m.id} market={m} result={results.find((r) => r.marketId === m.id && r.sessionDate === today)} />
          ))}
        </div>
      </section>

      {/* SCHEDULE */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="font-display text-3xl font-bold mb-6">Market Schedule</h2>
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium uppercase text-xs tracking-wider">Market</th>
                  <th className="px-4 py-3 font-medium uppercase text-xs tracking-wider">Open</th>
                  <th className="px-4 py-3 font-medium uppercase text-xs tracking-wider">Close</th>
                  <th className="px-4 py-3 font-medium uppercase text-xs tracking-wider">Result</th>
                  <th className="px-4 py-3 font-medium uppercase text-xs tracking-wider">Days</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => (
                  <tr key={m.id} className="border-t border-border/50">
                    <td className="px-4 py-3 font-display font-semibold">{m.displayName}</td>
                    <td className="px-4 py-3 text-center font-mono">{m.openTime}</td>
                    <td className="px-4 py-3 text-center font-mono">{m.closeTime}</td>
                    <td className="px-4 py-3 text-center font-mono text-primary">{m.resultTime}</td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">{m.days.length === 7 ? "All days" : m.days.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* QUICK STATS */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickStat label="Total Markets" value={String(markets.length)} />
          <QuickStat label="Declared Today" value={String(declaredToday)} accent />
          <QuickStat label="Pending" value={String(markets.length - declaredToday)} />
          <QuickStat label="Open Now" value={String(openNow)} />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-xl px-4 py-4">
      <div className="flex items-center justify-center gap-1.5 text-primary text-xs uppercase tracking-widest">
        {icon} {label}
      </div>
      <div className="font-display text-2xl md:text-3xl font-bold mt-2 text-glow-gold">{value}</div>
    </div>
  );
}

function QuickStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`glass rounded-xl p-5 text-center ${accent ? "ring-gold" : ""}`}>
      <div className={`font-display text-3xl font-bold ${accent ? "text-primary text-glow-gold" : "text-foreground"}`}>{value}</div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
