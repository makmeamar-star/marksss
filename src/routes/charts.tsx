import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PANA_CHART, panaType } from "@/lib/panaChart";
import { useMarkets, useResultsRange } from "@/hooks/useGameData";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/charts")({
  head: () => ({
    meta: [
      { title: "Matka Charts — Pana, Jodi & Open/Close · SattaKing Pro" },
      { name: "description", content: "Browse the official Matka pana chart, jodi history, and open/close digit frequency by market." },
      { property: "og:title", content: "Matka Charts — SattaKing Pro" },
    ],
  }),
  component: ChartsPage,
});

function ChartsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container mx-auto px-4 py-10">
        <h1 className="font-display text-4xl font-bold mb-2">Charts</h1>
        <p className="text-muted-foreground mb-8">Pana chart, jodi history, and open/close frequency analysis.</p>

        <Tabs defaultValue="pana">
          <TabsList className="bg-surface">
            <TabsTrigger value="pana">Pana Chart</TabsTrigger>
            <TabsTrigger value="jodi">Jodi Chart</TabsTrigger>
            <TabsTrigger value="oc">Open / Close</TabsTrigger>
          </TabsList>

          <TabsContent value="pana"><PanaChartView /></TabsContent>
          <TabsContent value="jodi"><JodiChartView /></TabsContent>
          <TabsContent value="oc"><OpenCloseView /></TabsContent>
        </Tabs>
      </section>
      <SiteFooter />
    </div>
  );
}

function PanaChartView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mt-6">
      {Object.entries(PANA_CHART).map(([digit, panas]) => (
        <div key={digit} className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-background font-display font-bold text-lg">
              {digit}
            </span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Digit {digit}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {panas.map((p) => (
              <span
                key={p}
                className={`text-center font-mono text-sm py-1.5 rounded-md border
                  ${panaType(p) === "TRIPLE" ? "border-accent/50 text-accent bg-accent/5"
                    : panaType(p) === "DOUBLE" ? "border-secondary/50 text-secondary bg-secondary/5"
                    : "border-border text-foreground"}`}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function JodiChartView() {
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsRange(60);
  const [marketId, setMarketId] = useState(markets[0]?.id);

  const data = useMemo(
    () => results
      .filter((r) => r.marketId === marketId && r.jodi)
      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
      .slice(0, 30),
    [results, marketId]
  );

  const freq = data.reduce<Record<string, number>>((m, r) => {
    if (r.jodi) m[r.jodi] = (m[r.jodi] ?? 0) + 1;
    return m;
  }, {});

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Market</span>
        <Select value={marketId} onValueChange={setMarketId}>
          <SelectTrigger className="w-56 bg-surface border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {markets.map((m) => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-xl p-5">
        <h3 className="font-display text-lg mb-3">Last 30 Jodis</h3>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
          {data.map((r) => {
            const isHot = (freq[r.jodi!] ?? 0) > 1;
            return (
              <div
                key={r.sessionDate}
                className={`text-center rounded-md p-2 font-mono text-lg font-bold
                  ${isHot ? "bg-primary/15 text-primary text-glow-gold ring-1 ring-primary/40"
                          : "bg-surface text-foreground"}`}
                title={r.sessionDate}
              >
                {r.jodi}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OpenCloseView() {
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsRange(30);
  const [marketId, setMarketId] = useState(markets[0]?.id);

  const data = results
    .filter((r) => r.marketId === marketId)
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
    .slice(0, 14);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Market</span>
        <Select value={marketId} onValueChange={setMarketId}>
          <SelectTrigger className="w-56 bg-surface border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            {markets.map((m) => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Open Pana</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Open Digit</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Close Digit</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Close Pana</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Jodi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.sessionDate} className="border-t border-border/50 text-center">
                <td className="px-4 py-2.5 text-left font-mono text-xs text-muted-foreground">{r.sessionDate}</td>
                <td className="px-4 py-2.5 font-mono">{r.openPana}</td>
                <td className="px-4 py-2.5 font-mono text-primary">{r.openDigit}</td>
                <td className="px-4 py-2.5 font-mono text-primary">{r.closeDigit}</td>
                <td className="px-4 py-2.5 font-mono">{r.closePana}</td>
                <td className="px-4 py-2.5 font-mono text-primary text-glow-gold font-bold">{r.jodi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
