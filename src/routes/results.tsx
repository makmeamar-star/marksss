import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResultCard } from "@/components/ResultCard";
import { ResultsTicker } from "@/components/ResultsTicker";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useMarkets, useResultsForDate, useResultsRange } from "@/hooks/useGameData";
import { todayIST } from "@/lib/marketTime";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Live Matka Results — SattaKing Pro" },
      { name: "description", content: "Live and historical Matka results across Kalyan, Main Mumbai, Milan, Rajdhani and more markets." },
      { property: "og:title", content: "Live Matka Results — SattaKing Pro" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const today = todayIST();
  const [date, setDate] = useState(today);

  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(date);
  const { data: history = [] } = useResultsRange(14);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <ResultsTicker />
      <section className="container mx-auto px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl font-bold">Results</h1>
            <p className="text-muted-foreground mt-1">Auto-refreshing live results · select a date for history</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="w-44 bg-surface border-border"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {markets.map((m) => (
            <ResultCard key={m.id} market={m} result={results.find((r) => r.marketId === m.id && r.sessionDate === date)} />
          ))}
        </div>

        <div className="glass rounded-xl mt-12 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h2 className="font-display text-xl font-bold">Last 14 Days · All Markets</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider">Date</th>
                  {markets.map((m) => (
                    <th key={m.id} className="px-3 py-3 text-xs uppercase tracking-wider whitespace-nowrap">{m.displayName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 14 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const ds = d.toISOString().slice(0, 10);
                  return (
                    <tr key={ds} className="border-t border-border/50">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{ds}</td>
                      {markets.map((m) => {
                        const r = history.find((x) => x.marketId === m.id && x.sessionDate === ds);
                        return (
                          <td key={m.id} className="px-3 py-2.5 text-center font-mono">
                            {r?.jodi
                              ? <span className="text-primary text-glow-gold font-bold">{r.openPana}-{r.jodi}-{r.closePana}</span>
                              : <span className="text-muted-foreground">— — —</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
