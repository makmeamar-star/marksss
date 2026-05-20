import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Dice5, Clock } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMarkets, useResultsForDate } from "@/hooks/useGameData";
import { useEnsureFreshResults } from "@/hooks/useEnsureFreshResults";
import { todayIST } from "@/lib/marketTime";

const JODI_MARKET_IDS = ["gali", "disawar", "faridabad", "ghaziabad"] as const;

export const Route = createFileRoute("/jodi")({
  head: () => ({
    meta: [
      { title: "Jodi 00–99 · Gali, Disawar, Faridabad, Ghaziabad — SattaKing Pro" },
      { name: "description", content: "Play and track classic North-Indian Jodi (00–99) markets — Gali, Disawar, Faridabad and Ghaziabad — with live timings, today's number and recent history." },
      { property: "og:title", content: "Jodi 00–99 — Gali, Disawar, Faridabad, Ghaziabad" },
      { property: "og:description", content: "Live Jodi 00–99 markets with timings and today's number." },
      { property: "og:url", content: "https://matka.world/jodi" },
    ],
    links: [{ rel: "canonical", href: "https://matka.world/jodi" }],
  }),
  component: JodiPage,
});

function JodiPage() {
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  useEnsureFreshResults();

  const jodiMarkets = useMemo(
    () => JODI_MARKET_IDS
      .map((id) => markets.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => !!m),
    [markets],
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-gold text-background">
            <Dice5 className="h-5 w-5" />
          </span>
          <h1 className="font-display text-4xl font-bold">
            Jodi <span className="text-primary text-glow-gold">00 – 99</span>
          </h1>
        </div>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          The classic North-Indian Jodi games — pick any number from 00 to 99 in Gali, Disawar, Faridabad and Ghaziabad. Payout 90× on the winning Jodi.
        </p>

        {jodiMarkets.length === 0 && (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground">
            Loading markets…
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {jodiMarkets.map((m) => {
            const r = results.find((x) => x.marketId === m.id && x.sessionDate === today);
            return (
              <div key={m.id} className="glass rounded-xl p-5 space-y-3 hover:border-primary/50 border border-border/60 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold">{m.displayName}</h3>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" /> {m.openTime} – {m.closeTime}
                    </div>
                  </div>
                  <Badge className={m.isOpen ? "bg-success/20 text-success border-success/40" : "bg-muted/30 text-muted-foreground border-border/60"}>
                    {m.isOpen ? "OPEN" : "CLOSED"}
                  </Badge>
                </div>

                <div className="rounded-lg bg-background/40 border border-primary/20 py-4 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Today's Jodi</div>
                  <div className="font-mono text-4xl font-bold text-primary text-glow-gold mt-1">
                    {r?.jodi ?? "--"}
                  </div>
                </div>

                <Button asChild className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
                  <Link to="/jodi/$marketId" params={{ marketId: m.id }}>Play Jodi 00–99</Link>
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-10 glass rounded-xl p-5 text-sm text-muted-foreground max-w-3xl">
          <h2 className="font-semibold text-foreground mb-2">How Jodi works</h2>
          <p>Pick any 2-digit number from <span className="font-mono text-primary">00</span> to <span className="font-mono text-primary">99</span> before the market closes. If your Jodi matches the declared result, you win <span className="text-primary font-semibold">90×</span> your stake. Markets run all 7 days a week.</p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
