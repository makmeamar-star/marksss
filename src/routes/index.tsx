import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Trophy, TrendingUp, Users, Sparkles } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResultCard } from "@/components/ResultCard";

import { RangoliDivider } from "@/components/RangoliDivider";
import { useMarkets, useResultsForDate, useLatestResultsPerMarket } from "@/hooks/useGameData";
import { useEnsureFreshResults } from "@/hooks/useEnsureFreshResults";
import { todayIST } from "@/lib/marketTime";
import { splitTopMarkets } from "@/lib/topMarkets";
import { useHomeMarketCount } from "@/hooks/useHomeMarketCount";

const ResultsTicker = lazy(() =>
  import("@/components/ResultsTicker").then((m) => ({ default: m.ResultsTicker })),
);
const TickerFallback = () => (
  <div className="border-y border-border/60 bg-surface/60 h-9" aria-hidden />
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SattaKing Pro — India's Most Trusted Matka Platform" },
      { name: "description", content: "Live Matka results, instant settlements, and a beautifully crafted betting experience. Kalyan, Main Mumbai, Milan, Rajdhani, Gali, Disawar — all in one place." },
      { property: "og:title", content: "SattaKing Pro — India's Most Trusted Matka Platform" },
      { property: "og:description", content: "Live Matka results & instant settlements across every major market." },
      { property: "og:url", content: "https://matka.world/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://matka.world/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  const { data: latestPerMarket = {}, isLoading: prevLoading, isError: prevError, refetch: refetchPrev } = useLatestResultsPerMarket();
  useEnsureFreshResults();

  // Hydration-safe: server has no realtime data, so render placeholders until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const declaredToday = results.filter((r) => r.status === "DECLARED").length;
  const openNow = markets.filter((m) => m.isOpen).length;
  const stat = (n: number) => (mounted ? String(n) : "—");


  const homeCount = useHomeMarketCount();
  const { top: allTopMarkets } = useMemo(() => splitTopMarkets(markets), [markets]);
  const topMarkets = useMemo(() => allTopMarkets.slice(0, homeCount), [allTopMarkets, homeCount]);

  return (
    <div className="min-h-screen bg-background">
      <div className="h-1 w-full bg-tricolour opacity-80" aria-hidden />
      <SiteHeader />
      <Suspense fallback={<TickerFallback />}>
        <ResultsTicker />
      </Suspense>

      {/* HERO */}
      <section className="relative overflow-hidden bg-radial-spotlight">
        <div className="absolute inset-0 particles-bg opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-mandala-dots opacity-[0.07] pointer-events-none" />
        <div className="container mx-auto px-4 py-12 md:py-16 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" />
              <span>Live Now</span>
              <span className="font-devanagari normal-case tracking-normal text-primary/80">· अभी लाइव</span>
            </span>
            <h1 className="font-display text-3xl md:text-5xl font-bold mt-4 leading-tight">
              India's Most Trusted
              <br />
              <span className="bg-gradient-india bg-clip-text text-transparent text-glow-diya">
                Matka Platform
              </span>
            </h1>
            <p className="font-devanagari text-sm md:text-base text-saffron mt-2">
              भरोसा · रफ़्तार · असली नतीजे
            </p>
            <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-2xl mx-auto">
              Play smart. Win big. Instant results across every major market — Kalyan, Main Mumbai, Milan, Rajdhani and more.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-6">
              <Button asChild size="sm" className="bg-gradient-india text-background font-bold shadow-[0_0_40px_-8px_var(--saffron)] hover:opacity-90">
                <Link to="/login">Sign In to Play <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
                <Link to="/results">View Results</Link>
              </Button>
            </div>

            {/* Live counters (real numbers from today's markets) */}
            <div className="grid grid-cols-3 gap-3 mt-10 max-w-lg mx-auto">
              <Stat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Active Markets" value={stat(markets.length)} />
              <Stat icon={<Trophy className="h-3.5 w-3.5" />} label="Declared Today" value={stat(declaredToday)} />
              <Stat icon={<Users className="h-3.5 w-3.5" />} label="Open Now" value={stat(openNow)} />

            </div>
          </motion.div>
        </div>
      </section>


      {/* LIVE RESULTS */}
      <section className="container mx-auto px-4 py-10">
        <RangoliDivider label="आज के नतीजे · Today" className="mb-8" />
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold">Today's Live Results</h2>
            <p className="text-sm text-muted-foreground mt-1">Auto-refreshing every 30 seconds</p>
          </div>
          <Link to="/results" className="hidden sm:inline-flex items-center gap-1 text-sm text-primary hover:underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mounted && topMarkets.map((m) => (
            <div key={m.id} className="space-y-1.5">
              <ResultCard market={m} result={results.find((r) => r.marketId === m.id)} previousResult={latestPerMarket[m.id]} showPreviousFallback previousLoading={prevLoading} previousError={prevError} onRetryPrevious={() => refetchPrev()} />
              <Button asChild size="sm" className="w-full h-8 text-xs bg-gradient-gold text-background font-bold hover:opacity-90">
                <Link to="/bet/$marketId" params={{ marketId: m.id }} preload="intent">Bet Now</Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          Showing top {mounted ? topMarkets.length : "—"} markets ·{" "}
          <Link to="/markets" className="text-primary hover:underline">View all markets</Link>
        </div>
      </section>

      {/* SCHEDULE */}
      <section className="container mx-auto px-4 py-8">
        <h2 className="font-display text-2xl font-bold mb-4">Market Schedule</h2>
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium uppercase text-[10px] tracking-wider">Market</th>
                  <th className="px-3 py-2 font-medium uppercase text-[10px] tracking-wider">Open</th>
                  <th className="px-3 py-2 font-medium uppercase text-[10px] tracking-wider">Close</th>
                  <th className="px-3 py-2 font-medium uppercase text-[10px] tracking-wider">Result</th>
                  <th className="px-3 py-2 font-medium uppercase text-[10px] tracking-wider">Days</th>
                </tr>
              </thead>
              <tbody>
                {mounted && topMarkets.map((m) => (
                  <ScheduleRow key={m.id} m={m} />
                ))}
              </tbody>

            </table>
          </div>
        </div>
        <div className="mt-2 text-center text-xs text-muted-foreground">
          Top {topMarkets.length} markets ·{" "}
          <Link to="/markets" className="text-primary hover:underline">Full schedule</Link>
        </div>
      </section>

      {/* QUICK STATS */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickStat label="Total Markets" value={stat(markets.length)} />
          <QuickStat label="Declared Today" value={stat(declaredToday)} accent />
          <QuickStat label="Pending" value={stat(markets.length - declaredToday)} />
          <QuickStat label="Open Now" value={stat(openNow)} />

        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-xl px-3 py-3">
      <div className="flex items-center justify-center gap-1.5 text-primary text-[10px] uppercase tracking-widest">
        {icon} {label}
      </div>
      <div className="font-display text-xl md:text-2xl font-bold mt-1 text-glow-gold">{value}</div>
    </div>
  );
}

function QuickStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`glass rounded-xl p-4 text-center ${accent ? "ring-gold" : ""}`}>
      <div className={`font-display text-2xl font-bold ${accent ? "text-primary text-glow-gold" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function ScheduleRow({ m }: { m: { id: string; displayName: string; openTime: string; closeTime: string; resultTime: string; days: string[] } }) {
  return (
    <tr className="border-t border-border/50">
      <td className="px-3 py-2 font-display font-semibold text-sm">{m.displayName}</td>
      <td className="px-3 py-2 text-center font-mono text-sm">{m.openTime}</td>
      <td className="px-3 py-2 text-center font-mono text-sm">{m.closeTime}</td>
      <td className="px-3 py-2 text-center font-mono text-sm text-primary">{m.resultTime}</td>
      <td className="px-3 py-2 text-center text-[10px] text-muted-foreground">{m.days.length === 7 ? "All days" : m.days.join(" ")}</td>
    </tr>
  );
}
