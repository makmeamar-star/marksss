import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResultCard } from "@/components/ResultCard";
import { useMarkets, useResultsForDate } from "@/hooks/useGameData";
import { useEnsureFreshResults } from "@/hooks/useEnsureFreshResults";
import { todayIST } from "@/lib/marketTime";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { splitTopMarkets } from "@/lib/topMarkets";

const STORAGE_KEY = "markets_show_all";

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
  useEnsureFreshResults();

  const { top, rest } = useMemo(() => splitTopMarkets(markets), [markets]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpen(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, val ? "1" : "0");
    }
  };

  const renderCard = (m: typeof markets[number]) => (
    <div key={m.id} className="space-y-2">
      <ResultCard market={m} result={results.find((r) => r.marketId === m.id && r.sessionDate === today)} />
      <Button asChild className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
        <Link to="/bet/$marketId" params={{ marketId: m.id }} preload="intent">Bet Now</Link>
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container mx-auto px-4 py-10">
        <h1 className="font-display text-4xl font-bold">Markets</h1>
        <p className="text-muted-foreground mt-1 mb-8">
          Pick a market to view bet types and place your stake.
        </p>

        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">
            Top {top.length} <span className="text-muted-foreground font-normal text-sm">· most popular</span>
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {top.map(renderCard)}
        </div>

        {rest.length > 0 && (
          <Collapsible open={open} onOpenChange={handleOpenChange} className="mt-10">
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between border-primary/30 text-primary hover:bg-primary/10"
              >
                <span>{open ? "Hide" : `Show all ${rest.length} more markets`}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rest.map(renderCard)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
