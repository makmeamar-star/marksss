import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useMemo } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StarMarketTile } from "@/components/StarMarketTile";
import { useMarkets, useResultsForDate, useLatestResultsPerMarket } from "@/hooks/useGameData";
import { useEnsureFreshResults } from "@/hooks/useEnsureFreshResults";
import { todayIST } from "@/lib/marketTime";
import { pickStarMarkets } from "@/config/starMarkets";

export const Route = createFileRoute("/star")({
  head: () => ({
    meta: [
      { title: "Delhi Markets — Gali · Disawar · Faridabad · Ghaziabad" },
      {
        name: "description",
        content:
          "Live results, today's open & close, and one-tap play for the most popular markets — Gali, Disawar, Faridabad and Ghaziabad.",
      },
      { property: "og:title", content: "Delhi Markets — Gali, Disawar, Faridabad, Ghaziabad" },
      {
        property: "og:description",
        content: "Live Matka results for the four most-watched markets, with one-tap betting.",
      },
    ],
  }),
  component: StarPage,
});

function StarPage() {
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  const { data: latestPerMarket = {} } = useLatestResultsPerMarket(7);
  useEnsureFreshResults();

  const stars = useMemo(() => pickStarMarkets(markets), [markets]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="container mx-auto px-4 pt-8 pb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-gold text-background shadow-[0_0_24px_-4px_var(--primary)]">
            <Star className="h-5 w-5 fill-current" />
          </span>
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold leading-none">
              Delhi Markets
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gali · Disawar · Faridabad · Ghaziabad — live every day
            </p>
          </div>
        </div>

        {stars.length === 0 ? (
          <div className="mt-10 rounded-xl border border-border p-8 text-center text-muted-foreground">
            Loading featured markets…
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stars.map((m) => (
              <StarMarketTile
                key={m.id}
                market={m}
                result={results.find((r) => r.marketId === m.id)}
                recentJodis={latestPerMarket[m.id]?.jodi ? [latestPerMarket[m.id].jodi as string] : []}
              />
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
