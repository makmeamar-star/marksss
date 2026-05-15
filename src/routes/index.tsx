import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Trophy, TrendingUp, Users, Sparkles, ChevronDown } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResultCard } from "@/components/ResultCard";
import { StarMarketsSection } from "@/components/StarMarketsSection";
import { RangoliDivider } from "@/components/RangoliDivider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMarkets, useResultsForDate, useLatestResultsPerMarket } from "@/hooks/useGameData";
import { useEnsureFreshResults } from "@/hooks/useEnsureFreshResults";
import { todayIST } from "@/lib/marketTime";
import { splitTopMarkets } from "@/lib/topMarkets";

const ResultsTicker = lazy(() =>
  import("@/components/ResultsTicker").then((m) => ({ default: m.ResultsTicker })),
);
const TickerFallback = () => (
  <div className="border-y border-border/60 bg-surface/60 h-9" aria-hidden />
);

const HOME_STORAGE_KEY = "home_show_all_markets";

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
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  const { data: latestPerMarket = {}, isLoading: prevLoading, isError: prevError, refetch: refetchPrev } = useLatestResultsPerMarket();
  useEnsureFreshResults();

  const declaredToday = results.filter((r) => r.status === "DECLARED").length;
  const openNow = markets.filter((m) => m.isOpen).length;

  const { top: topMarkets, rest: restMarkets } = useMemo(() => splitTopMarkets(markets), [markets]);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowAll(localStorage.getItem(HOME_STORAGE_KEY) === "1");
  }, []);
  const onShowAllChange = (v: boolean) => {
    setShowAll(v);
    if (typeof window !== "undefined") localStorage.setItem(HOME_STORAGE_KEY, v ? "1" : "0");
  };

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
        <div className="container mx-auto px-4 py-20 md:py-28 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Live Now</span>
              <span className="font-devanagari normal-case tracking-normal text-primary/80">· अभी लाइव</span>
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-bold mt-6 leading-tight">
              India's Most Trusted
              <br />
              <span className="bg-gradient-india bg-clip-text text-transparent text-glow-diya">
                Matka Platform
              </span>
            </h1>
            <p className="font-devanagari text-base md:text-lg text-saffron mt-3">
              भरोसा · रफ़्तार · असली नतीजे
            </p>
            <p className="text-lg md:text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
              Play smart. Win big. Instant results across every major market — Kalyan, Main Mumbai, Milan, Rajdhani and more.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <Button asChild size="lg" className="bg-gradient-india text-background font-bold shadow-[0_0_40px_-8px_var(--saffron)] hover:opacity-90">
                <Link to="/register">Play Now <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
                <Link to="/results">View Results</Link>
              </Button>
            </div>

            {/* Live counters (real numbers from today's markets) */}
            <div className="grid grid-cols-3 gap-4 mt-14 max-w-xl mx-auto">
              <Stat icon={<TrendingUp className="h-4 w-4" />} label="Active Markets" value={String(markets.length)} />
              <Stat icon={<Trophy className="h-4 w-4" />} label="Declared Today" value={String(declaredToday)} />
              <Stat icon={<Users className="h-4 w-4" />} label="Open Now" value={String(openNow)} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* STAR MARKETS — pinned featured 4 */}
      <StarMarketsSection />

      {/* LIVE RESULTS */}
      <section className="container mx-auto px-4 py-16">
        <RangoliDivider label="आज के नतीजे · Today" className="mb-10" />
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
          {topMarkets.map((m) => (
            <ResultCard key={m.id} market={m} result={results.find((r) => r.marketId === m.id)} previousResult={latestPerMarket[m.id]} showPreviousFallback previousLoading={prevLoading} previousError={prevError} onRetryPrevious={() => refetchPrev()} />
          ))}
        </div>
        {restMarkets.length > 0 && (
          <Collapsible open={showAll} onOpenChange={onShowAllChange} className="mt-8">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between border-primary/30 text-primary hover:bg-primary/10">
                <span>{showAll ? "Hide" : `Show all ${restMarkets.length} more markets`}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {restMarkets.map((m) => (
                  <ResultCard key={m.id} market={m} result={results.find((r) => r.marketId === m.id)} previousResult={latestPerMarket[m.id]} showPreviousFallback previousLoading={prevLoading} previousError={prevError} onRetryPrevious={() => refetchPrev()} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
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
                {topMarkets.map((m) => (
                  <ScheduleRow key={m.id} m={m} />
                ))}
                {showAll && restMarkets.map((m) => (
                  <ScheduleRow key={m.id} m={m} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {restMarkets.length > 0 && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => onShowAllChange(!showAll)}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              {showAll ? "Hide extra markets" : `Show all ${restMarkets.length} more in schedule`}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
            </button>
          </div>
        )}
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

function ScheduleRow({ m }: { m: { id: string; displayName: string; openTime: string; closeTime: string; resultTime: string; days: string[] } }) {
  return (
    <tr className="border-t border-border/50">
      <td className="px-4 py-3 font-display font-semibold">{m.displayName}</td>
      <td className="px-4 py-3 text-center font-mono">{m.openTime}</td>
      <td className="px-4 py-3 text-center font-mono">{m.closeTime}</td>
      <td className="px-4 py-3 text-center font-mono text-primary">{m.resultTime}</td>
      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{m.days.length === 7 ? "All days" : m.days.join(" ")}</td>
    </tr>
  );
}
