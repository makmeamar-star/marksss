import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResultCard } from "@/components/ResultCard";
import { useMarketStore } from "@/stores/marketStore";

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
  const markets = useMarketStore((s) => s.markets);
  const results = useMarketStore((s) => s.results);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container mx-auto px-4 py-10">
        <h1 className="font-display text-4xl font-bold">Markets</h1>
        <p className="text-muted-foreground mt-1 mb-8">
          Tap a market to see details. Betting flows arrive in Phase 2 — for now,{" "}
          <Link to="/login" className="text-primary hover:underline">log in</Link> to preview the dashboard shell.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {markets.map((m) => (
            <ResultCard key={m.id} market={m} result={results.find((r) => r.marketId === m.id && r.sessionDate === today)} />
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
