import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { NumberGrid } from "@/components/NumberGrid";
import { BetSlipDesktop, BetSlipMobile } from "@/components/BetSlip";
import { CountdownTimer } from "@/components/CountdownTimer";
import { useMarkets } from "@/hooks/useGameData";
import { useBetStore } from "@/stores/betStore";
import { PANA_CHART, panaType } from "@/lib/panaChart";
import type { BetType, SessionType } from "@/lib/types";
import { payoutFor } from "@/lib/settlement";
import { isOpenSessionOpen, isCloseSessionOpen } from "@/lib/marketTime";

export const Route = createFileRoute("/_authenticated/bet/$marketId")({
  head: ({ params }) => ({ meta: [{ title: `Place Bet · ${params.marketId} — SattaKing Pro` }] }),
  component: BetPage,
});

const QUICK_AMOUNTS = [10, 50, 100, 500, 1000];

function BetPage() {
  const { marketId } = Route.useParams();
  const { data: markets = [] } = useMarkets();
  const market = markets.find((m) => m.id === marketId);
  const addToSlip = useBetStore((s) => s.addToSlip);

  const [session, setSession] = useState<SessionType>("OPEN");
  const [amount, setAmount] = useState<number>(10);
  // Tick every second so session windows recompute live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  if (!market) throw notFound();

  const openOpen = isOpenSessionOpen(market);
  const closeOpen = isCloseSessionOpen(market);
  const bothClosed = !openOpen && !closeOpen;

  // Auto-switch if currently selected session is no longer bettable.
  useEffect(() => {
    if (session === "OPEN" && !openOpen && closeOpen) setSession("CLOSE");
  }, [session, openOpen, closeOpen]);

  const sessionAvailable = session === "OPEN" ? openOpen : closeOpen;
  const countdownTarget = session === "OPEN" ? market.openTime : market.closeTime;
  const countdownLabel = session === "OPEN" ? "Open closes in" : "Close closes in";

  const add = (betType: BetType, betNumber: string) => {
    if (bothClosed) return toast.error("Betting closed for today");
    if (!sessionAvailable) return toast.error(`${session} session closed`);
    if (amount < market.minBet) return toast.error(`Minimum bet is ₹${market.minBet}`);
    if (amount > market.maxBet) return toast.error(`Maximum bet is ₹${market.maxBet}`);
    addToSlip({
      marketId: market.id,
      marketName: market.displayName,
      session,
      betType,
      betNumber,
      amount,
      payout: payoutFor(market, betType),
    });
    toast.success(`Added ${betType} · ${betNumber} · ₹${amount}`);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Link to="/markets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> All markets
      </Link>

      <div className="grid xl:grid-cols-[1fr_20rem] gap-6 items-start">
        <div className="min-w-0 space-y-6">
          {/* Market header */}
          <div className="glass rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold">{market.displayName}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Open {market.openTime} · Close {market.closeTime} · Result {market.resultTime}
              </p>
              <div className="flex flex-wrap gap-2 mt-2 text-[10px] uppercase tracking-widest">
                <Badge variant="outline">Min ₹{market.minBet}</Badge>
                <Badge variant="outline">Max ₹{market.maxBet}</Badge>
                <Badge variant="outline">Single {market.payouts.single}x</Badge>
                <Badge variant="outline">Jodi {market.payouts.jodi}x</Badge>
                <Badge variant="outline">Pana {market.payouts.singlePana}x</Badge>
              </div>
            </div>
            {bothClosed ? (
              <Badge variant="outline" className="text-danger border-danger/40">
                <Lock className="h-3 w-3 mr-1" /> Closed for today
              </Badge>
            ) : (
              <CountdownTimer targetTime={countdownTarget} label={countdownLabel} />
            )}
          </div>

          {/* Session toggle */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
                {(["OPEN", "CLOSE"] as const).map((s) => {
                  const avail = s === "OPEN" ? openOpen : closeOpen;
                  return (
                    <button
                      key={s}
                      onClick={() => avail && setSession(s)}
                      disabled={!avail}
                      title={!avail ? `${s} session closed` : undefined}
                      className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-1
                        ${session === s && avail ? "bg-gradient-gold text-background" : "text-muted-foreground hover:text-foreground"}
                        ${!avail ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                    >
                      {!avail && <Lock className="h-3 w-3" />}
                      {s} Session
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Stake</span>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-24 bg-surface border-border font-mono"
                />
                <div className="flex gap-1">
                  {QUICK_AMOUNTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAmount(a)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono border
                        ${amount === a ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      ₹{a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {bothClosed && (
            <div className="glass rounded-xl p-4 border border-danger/40 text-center">
              <Lock className="h-5 w-5 mx-auto mb-2 text-danger" />
              <p className="text-sm font-semibold text-danger">Betting closed for today</p>
              <p className="text-xs text-muted-foreground mt-1">
                Open cutoff {market.openTime} · Close cutoff {market.closeTime} (IST). New bets open in the next session.
              </p>
            </div>
          )}

          {/* Bet type tabs */}
          <Tabs defaultValue="single" className="space-y-4">
            <TabsList className="bg-surface flex-wrap h-auto">
              <TabsTrigger value="single">Single</TabsTrigger>
              <TabsTrigger value="jodi">Jodi</TabsTrigger>
              {!market.isJodiOnly && <TabsTrigger value="pana">Pana</TabsTrigger>}
              {!market.isJodiOnly && <TabsTrigger value="halfsangam">Half Sangam</TabsTrigger>}
              {!market.isJodiOnly && <TabsTrigger value="fullsangam">Full Sangam</TabsTrigger>}
            </TabsList>

            <TabsContent value="single">
              <Section title={`Single Digit · ${session} · ${market.payouts.single}x`}>
                <NumberGrid
                  numbers={Array.from({ length: 10 }, (_, i) => String(i))}
                  onPick={(n) => add(session === "OPEN" ? "SINGLE_OPEN" : "SINGLE_CLOSE", n)}
                />
              </Section>
            </TabsContent>

            <TabsContent value="jodi">
              <Section title={`Jodi · ${market.payouts.jodi}x`}>
                <NumberGrid
                  numbers={Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, "0"))}
                  onPick={(n) => add("JODI", n)}
                />
              </Section>
            </TabsContent>

            {!market.isJodiOnly && (
              <>
                <TabsContent value="pana" className="space-y-4">
                  <PanaSection
                    title="Single Pana"
                    payout={market.payouts.singlePana}
                    filter="SINGLE"
                    onPick={(n) => add("SINGLE_PANA", n)}
                  />
                  <PanaSection
                    title="Double Pana"
                    payout={market.payouts.doublePana}
                    filter="DOUBLE"
                    onPick={(n) => add("DOUBLE_PANA", n)}
                  />
                  <PanaSection
                    title="Triple Pana"
                    payout={market.payouts.triplePana}
                    filter="TRIPLE"
                    onPick={(n) => add("TRIPLE_PANA", n)}
                  />
                </TabsContent>

                <TabsContent value="halfsangam">
                  <SangamHalf onAdd={(n) => add("HALF_SANGAM", n)} payout={market.payouts.halfSangam} />
                </TabsContent>

                <TabsContent value="fullsangam">
                  <SangamFull onAdd={(n) => add("FULL_SANGAM", n)} payout={market.payouts.fullSangam} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>

        <BetSlipDesktop />
      </div>

      <BetSlipMobile />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-5">
      <h3 className="font-display text-lg mb-4 flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function PanaSection({
  title, payout, filter, onPick,
}: { title: string; payout: number; filter: "SINGLE" | "DOUBLE" | "TRIPLE"; onPick: (n: string) => void }) {
  const all = Object.values(PANA_CHART).flat().filter((p) => panaType(p) === filter);
  const unique = Array.from(new Set(all));
  return (
    <Section title={`${title} · ${payout}x`}>
      <NumberGrid numbers={unique} onPick={onPick} cols={6} />
    </Section>
  );
}

function SangamHalf({ onAdd, payout }: { onAdd: (n: string) => void; payout: number }) {
  const [digit, setDigit] = useState<string>("");
  const [pana, setPana] = useState<string>("");
  const [mode, setMode] = useState<"D-P" | "P-D">("D-P");

  const all = Object.values(PANA_CHART).flat();
  const unique = Array.from(new Set(all));

  const submit = () => {
    if (!digit || !pana) return toast.error("Pick a digit and a pana");
    const combo = mode === "D-P" ? `${digit}-${pana}` : `${pana}-${digit}`;
    onAdd(combo);
    setDigit(""); setPana("");
  };

  return (
    <Section title={`Half Sangam · ${payout}x`}>
      <div className="flex items-center gap-1 rounded-lg bg-surface p-1 w-fit mb-4">
        <button onClick={() => setMode("D-P")} className={`px-3 py-1 text-xs rounded ${mode === "D-P" ? "bg-gradient-gold text-background" : "text-muted-foreground"}`}>Open Digit + Close Pana</button>
        <button onClick={() => setMode("P-D")} className={`px-3 py-1 text-xs rounded ${mode === "P-D" ? "bg-gradient-gold text-background" : "text-muted-foreground"}`}>Open Pana + Close Digit</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{mode === "D-P" ? "Open Digit" : "Close Digit"}</p>
          <NumberGrid numbers={Array.from({ length: 10 }, (_, i) => String(i))} onPick={setDigit} selected={digit} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{mode === "D-P" ? "Close Pana" : "Open Pana"}</p>
          <div className="max-h-64 overflow-y-auto pr-1">
            <NumberGrid numbers={unique} onPick={setPana} selected={pana} cols={6} />
          </div>
        </div>
      </div>

      <Button onClick={submit} disabled={!digit || !pana} size="sm" className="mt-4 h-8 text-xs bg-gradient-gold text-background font-bold hover:opacity-90">
        <Plus className="h-4 w-4 mr-1" /> Add to slip
      </Button>
    </Section>
  );
}

function SangamFull({ onAdd, payout }: { onAdd: (n: string) => void; payout: number }) {
  const [open, setOpen] = useState("");
  const [close, setClose] = useState("");
  const all = Array.from(new Set(Object.values(PANA_CHART).flat()));

  const submit = () => {
    if (!open || !close) return toast.error("Pick both panas");
    onAdd(`${open}-${close}`);
    setOpen(""); setClose("");
  };

  return (
    <Section title={`Full Sangam · ${payout}x`}>
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Open Pana</p>
          <div className="max-h-64 overflow-y-auto pr-1">
            <NumberGrid numbers={all} onPick={setOpen} selected={open} cols={6} />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Close Pana</p>
          <div className="max-h-64 overflow-y-auto pr-1">
            <NumberGrid numbers={all} onPick={setClose} selected={close} cols={6} />
          </div>
        </div>
      </div>
      <Button onClick={submit} disabled={!open || !close} size="sm" className="mt-4 h-8 text-xs bg-gradient-gold text-background font-bold hover:opacity-90">
        <Plus className="h-4 w-4 mr-1" /> Add to slip
      </Button>
    </Section>
  );
}
