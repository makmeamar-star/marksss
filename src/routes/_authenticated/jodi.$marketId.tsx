import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Shuffle, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BetSlipDesktop, BetSlipMobile } from "@/components/BetSlip";
import { CountdownTimer } from "@/components/CountdownTimer";
import { useMarkets } from "@/hooks/useGameData";
import { useBetStore } from "@/stores/betStore";
import { payoutFor } from "@/lib/settlement";

export const Route = createFileRoute("/_authenticated/jodi/$marketId")({
  head: ({ params }) => ({
    meta: [{ title: `Jodi 00–99 · ${params.marketId} — SattaKing Pro` }],
  }),
  component: JodiBetPage,
});

const QUICK_AMOUNTS = [10, 50, 100, 500, 1000];
const ALL_JODIS = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, "0"));

type Filter = "ALL" | "EVEN" | "ODD" | "PAIRS" | "FAVORITES";

function JodiBetPage() {
  const { marketId } = Route.useParams();
  const { data: markets = [] } = useMarkets();
  const market = markets.find((m) => m.id === marketId);
  const addToSlip = useBetStore((s) => s.addToSlip);

  const [amount, setAmount] = useState<number>(10);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  if (!market) throw notFound();

  const payout = market.payouts.jodi;

  const visibleJodis = useMemo(() => {
    switch (filter) {
      case "EVEN": return ALL_JODIS.filter((j) => Number(j) % 2 === 0);
      case "ODD":  return ALL_JODIS.filter((j) => Number(j) % 2 === 1);
      case "PAIRS": return ALL_JODIS.filter((j) => j[0] === j[1]);
      case "FAVORITES": return ALL_JODIS.filter((j) => picked.has(j));
      default: return ALL_JODIS;
    }
  }, [filter, picked]);

  const togglePick = (n: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  const addManual = () => {
    const n = input.trim().padStart(2, "0");
    if (!/^\d{2}$/.test(n)) return toast.error("Enter a 2-digit number 00–99");
    togglePick(n);
    setInput("");
  };

  const randomPick = (count: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      let tries = 0;
      while (next.size < prev.size + count && tries < count * 20) {
        next.add(String(Math.floor(Math.random() * 100)).padStart(2, "0"));
        tries++;
      }
      return next;
    });
  };

  const addAllToSlip = () => {
    if (picked.size === 0) return toast.error("Select at least one Jodi");
    if (amount < market.minBet) return toast.error(`Min bet ₹${market.minBet}`);
    if (amount > market.maxBet) return toast.error(`Max bet ₹${market.maxBet}`);
    let n = 0;
    picked.forEach((num) => {
      addToSlip({
        marketId: market.id,
        marketName: market.displayName,
        session: "OPEN",
        betType: "JODI",
        betNumber: num,
        amount,
        payout: payoutFor(market, "JODI"),
      });
      n++;
    });
    toast.success(`Added ${n} Jodi · ₹${amount} each (₹${(n * amount).toLocaleString("en-IN")} total)`);
    setPicked(new Set());
  };

  const totalStake = picked.size * amount;
  const totalPotential = totalStake * payout;

  return (
    <div className="container mx-auto px-4 py-6">
      <Link to="/jodi" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Jodi markets
      </Link>

      <div className="grid xl:grid-cols-[1fr_20rem] gap-6 items-start">
        <div className="min-w-0 space-y-5">
          {/* Header */}
          <div className="glass rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold">{market.displayName} · Jodi 00–99</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Open {market.openTime} · Close {market.closeTime} · Result {market.resultTime}
              </p>
              <div className="flex flex-wrap gap-2 mt-2 text-[10px] uppercase tracking-widest">
                <Badge variant="outline">Min ₹{market.minBet}</Badge>
                <Badge variant="outline">Max ₹{market.maxBet}</Badge>
                <Badge className="bg-primary/15 text-primary border-primary/40">Payout {payout}×</Badge>
              </div>
            </div>
            <CountdownTimer targetTime={market.closeTime} label="Closes in" />
          </div>

          {/* Stake selector */}
          <div className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Stake / Jodi</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-24 bg-surface border-border font-mono"
              />
              <div className="flex gap-1 flex-wrap">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border ${
                      amount === a
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    ₹{a}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Selected <span className="text-foreground font-mono">{picked.size}</span> ·
              Stake <span className="text-foreground font-mono">₹{totalStake.toLocaleString("en-IN")}</span> ·
              Win up to <span className="text-primary font-mono">₹{totalPotential.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Manual entry + quick actions */}
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onKeyDown={(e) => e.key === "Enter" && addManual()}
                placeholder="Type 00–99"
                inputMode="numeric"
                maxLength={2}
                className="w-32 font-mono text-lg text-center bg-surface"
              />
              <Button onClick={addManual} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Jodi
              </Button>
              <div className="h-5 w-px bg-border mx-1" />
              <Button onClick={() => randomPick(5)} variant="outline" size="sm">
                <Shuffle className="h-4 w-4 mr-1" /> Lucky 5
              </Button>
              <Button onClick={() => randomPick(10)} variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-1" /> Lucky 10
              </Button>
              {picked.size > 0 && (
                <Button onClick={() => setPicked(new Set())} variant="ghost" size="sm" className="text-destructive">
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>

            {/* Selected chips */}
            {picked.size > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                {Array.from(picked).sort().map((j) => (
                  <button
                    key={j}
                    onClick={() => togglePick(j)}
                    className="font-mono text-sm px-2.5 py-1 rounded-md bg-primary/15 border border-primary/40 text-primary hover:bg-destructive/20 hover:border-destructive/40 hover:text-destructive transition"
                    title="Remove"
                  >
                    {j} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-1 rounded-lg bg-surface p-1 w-fit">
            {(["ALL", "EVEN", "ODD", "PAIRS", "FAVORITES"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  filter === f ? "bg-gradient-gold text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
                {f === "FAVORITES" && picked.size > 0 && ` (${picked.size})`}
              </button>
            ))}
          </div>

          {/* 00–99 grid */}
          <div className="glass rounded-xl p-4">
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
              {visibleJodis.map((n) => {
                const isOn = picked.has(n);
                return (
                  <button
                    key={n}
                    onClick={() => togglePick(n)}
                    className={`aspect-square rounded-md font-mono text-sm font-semibold border transition-all ${
                      isOn
                        ? "bg-gradient-gold text-background border-primary shadow-[0_0_12px_-2px_var(--primary)] scale-105"
                        : "bg-surface text-foreground border-border/60 hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {visibleJodis.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No Jodis match this filter.</p>
            )}
          </div>

          {/* Sticky add bar */}
          <div className="sticky bottom-4 glass-gold rounded-xl p-3 flex items-center justify-between gap-3 shadow-lg">
            <div className="text-xs">
              <div className="text-muted-foreground">Stake total</div>
              <div className="font-mono text-lg font-bold">₹{totalStake.toLocaleString("en-IN")}</div>
            </div>
            <Button
              onClick={addAllToSlip}
              disabled={picked.size === 0}
              size="sm"
              className="h-8 text-xs bg-gradient-gold text-background font-bold hover:opacity-90 flex-1 max-w-xs"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add {picked.size > 0 ? `${picked.size} Jodi` : "to slip"}
            </Button>
          </div>
        </div>

        <BetSlipDesktop />
      </div>
      <BetSlipMobile />
    </div>
  );
}
