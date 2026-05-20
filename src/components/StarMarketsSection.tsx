import { useMemo } from "react";
import { Star } from "lucide-react";
import { StarMarketTile } from "./StarMarketTile";
import { useMarkets, useResultsForDate, useLatestResultsPerMarket } from "@/hooks/useGameData";
import { todayIST } from "@/lib/marketTime";
import { pickStarMarkets } from "@/config/starMarkets";

interface Props {
  /** When true, render as a horizontally scrollable strip (used in /markets sticky bar). */
  scroll?: boolean;
  /** When true, hide the section header (used inside other layouts). */
  hideHeader?: boolean;
}

/**
 * Featured "Delhi Markets" section: pinned grid of Gali, Disawar,
 * Faridabad, Ghaziabad with today's result + Play CTA.
 */
export function StarMarketsSection({ scroll, hideHeader }: Props) {
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  const { data: latestPerMarket = {} } = useLatestResultsPerMarket(7);

  const stars = useMemo(() => pickStarMarkets(markets), [markets]);

  if (stars.length === 0) return null;

  return (
    <section
      className={`relative ${scroll ? "" : "container mx-auto px-4 py-6 md:py-8"}`}
      aria-label="Featured markets"
    >
      {!hideHeader && (
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-gold text-background">
              <Star className="h-3 w-3 fill-current" />
            </span>
            <div>
              <h2 className="font-display text-xl md:text-2xl font-bold leading-none">
                Delhi Markets
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Gali · Disawar · Faridabad · Ghaziabad — live every day
              </p>
            </div>
          </div>
        </div>
      )}

      {scroll ? (
        <div className="-mx-4 overflow-x-auto pb-2 px-4 snap-x snap-mandatory">
          <div className="flex gap-2 min-w-max">
            {stars.map((m) => (
              <div key={m.id} className="w-[220px] snap-start">
                <StarMarketTile
                  market={m}
                  result={results.find((r) => r.marketId === m.id)}
                  recentJodis={extractJodis(latestPerMarket[m.id])}
                  compact
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stars.map((m) => (
            <StarMarketTile
              key={m.id}
              market={m}
              result={results.find((r) => r.marketId === m.id)}
              recentJodis={extractJodis(latestPerMarket[m.id])}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Pull a single jodi out of the latest result per-market (only one is cached). */
function extractJodis(latest: any): string[] {
  if (!latest?.jodi) return [];
  return [latest.jodi];
}
