import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResultCard } from "@/components/ResultCard";
import { useMarkets, useResultsForDate } from "@/hooks/useGameData";
import { useEnsureFreshResults } from "@/hooks/useEnsureFreshResults";
import { todayIST } from "@/lib/marketTime";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets — SattaKing Pro" },
      { name: "description", content: "All active Matka markets with timings, status and live results." },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container mx-auto px-4 py-10">
        <h1 className="font-display text-4xl font-bold">Markets</h1>
        <p className="text-muted-foreground mt-1 mb-8">Pick a market to view bet types and place your stake.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {markets.map((m) => (
            <div key={m.id} className="space-y-2">
              <ResultCard market={m} result={results.find((r) => r.marketId === m.id && r.sessionDate === today)} />
              <Button asChild className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
                <Link to="/bet/$marketId" params={{ marketId: m.id }}>Bet Now</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
