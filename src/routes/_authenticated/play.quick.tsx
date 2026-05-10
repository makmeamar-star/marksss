import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Timer, Trophy, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { RangoliDivider } from "@/components/RangoliDivider";

export const Route = createFileRoute("/_authenticated/play/quick")({
  head: () => ({ meta: [{ title: "Quick Play 5-min — SattaKing Pro" }] }),
  component: QuickPlay,
});

type Round = {
  id: string;
  round_no: number;
  opens_at: string;
  closes_at: string;
  declared_at: string | null;
  result_digit: number | null;
  payout_multiplier: number;
  status: "OPEN" | "CLOSED" | "DECLARED";
};
type MyBet = {
  id: string;
  round_id: string;
  digit: number;
  amount: number;
  status: "PENDING" | "WON" | "LOST";
  win_amount: number;
  created_at: string;
};

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtSec(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function QuickPlay() {
  const refresh = useAuthStore((s) => s.refreshProfile);
  const balance = useAuthStore((s) => s.user?.balance ?? 0);
  const [round, setRound] = useState<Round | null>(null);
  const [recent, setRecent] = useState<Round[]>([]);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [digit, setDigit] = useState<number | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  async function load() {
    const [{ data: open }, { data: rec }, { data: auth }] = await Promise.all([
      supabase.from("quick_rounds").select("*").eq("status", "OPEN").order("closes_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("quick_rounds").select("*").eq("status", "DECLARED").order("declared_at", { ascending: false }).limit(10),
      supabase.auth.getUser(),
    ]);
    setRound(open as Round | null);
    setRecent((rec ?? []) as Round[]);
    if (auth.user?.id) {
      const { data: bets } = await supabase
        .from("quick_bets").select("*").eq("user_id", auth.user.id)
        .order("created_at", { ascending: false }).limit(15);
      setMyBets((bets ?? []) as MyBet[]);
    }
  }

  useEffect(() => { load(); }, []);

  // Realtime — refresh on round/bet changes
  useEffect(() => {
    const ch = supabase
      .channel("quick-play")
      .on("postgres_changes", { event: "*", schema: "public", table: "quick_rounds" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "quick_bets" }, () => { load(); refresh?.(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // When countdown crosses zero, refresh shortly after to pick up the new round
  const closesMs = round ? new Date(round.closes_at).getTime() - now : 0;
  useEffect(() => {
    if (round && closesMs <= 0) {
      const t = setTimeout(load, 1500);
      return () => clearTimeout(t);
    }
  }, [round, closesMs]);

  const myCurrent = useMemo(
    () => (round ? myBets.filter((b) => b.round_id === round.id) : []),
    [round, myBets]
  );

  async function placeBet() {
    if (!round) return;
    if (digit === null) { toast.error("Pick a digit 0–9"); return; }
    if (amount < 10) { toast.error("Minimum bet is ₹10"); return; }
    if (amount > balance) { toast.error("Insufficient balance"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("place_quick_bet", {
      p_round_id: round.id,
      p_digit: digit,
      p_amount: amount,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean };
    if (!res?.ok) { toast.error("Bet failed"); return; }
    toast.success(`Bet placed on ${digit} for ₹${amount}`);
    setDigit(null);
    await Promise.all([load(), refresh?.()]);
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <div className="text-center">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-glow-diya inline-flex items-center gap-3">
          <Zap className="h-7 w-7 text-saffron" /> Quick Play 5-min
        </h1>
        <p className="font-devanagari text-saffron text-sm mt-1">हर 5 मिनट · नया रिज़ल्ट</p>
      </div>

      {/* Live round */}
      <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 mandala-corner">
        <div className="p-6 grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Timer className="h-4 w-4" /> Round #{round?.round_no ?? "—"}
            </div>
            <div className="font-display text-5xl md:text-6xl font-bold text-glow-diya mt-1">
              {round ? fmtSec(closesMs) : "—"}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a digit · win {round?.payout_multiplier ?? 9}× your stake
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Balance</div>
            <div className="font-display text-2xl font-bold text-primary">₹{balance.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from({ length: 10 }).map((_, d) => {
              const selected = digit === d;
              return (
                <motion.button
                  key={d}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ y: -3 }}
                  onClick={() => setDigit(d)}
                  className={`aspect-square rounded-xl font-display text-2xl font-bold border-2 transition-colors
                    ${selected
                      ? "bg-gradient-india text-background border-transparent shadow-[0_0_24px_-4px_hsl(var(--saffron)/0.7)]"
                      : "bg-card border-border/60 hover:border-primary/50 text-foreground"}`}
                >
                  {d}
                </motion.button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground">Amount (₹10–₹5000)</label>
              <Input
                type="number"
                min={10}
                max={5000}
                step={10}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                className="bg-background"
              />
            </div>
            <div className="flex gap-1">
              {[10, 50, 100, 500].map((v) => (
                <Button key={v} variant="outline" size="sm" onClick={() => setAmount(v)}>₹{v}</Button>
              ))}
            </div>
            <Button
              disabled={busy || !round || closesMs <= 0}
              onClick={placeBet}
              className="bg-gradient-gold text-background font-bold hover:opacity-90 ml-auto"
              size="lg"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Place ₹${amount} on ${digit ?? "?"}`}
            </Button>
          </div>

          {myCurrent.length > 0 && (
            <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
              <span>This round:</span>
              {myCurrent.map((b) => (
                <Badge key={b.id} variant="outline" className="border-primary/40 text-primary">
                  {b.digit} · ₹{b.amount}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      <RangoliDivider label="Recent Results · पिछले नतीजे" />

      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {recent.map((r) => (
          <div key={r.id} className="rounded-lg border border-border/60 bg-card p-2 text-center">
            <div className="text-[10px] text-muted-foreground">#{r.round_no}</div>
            <div className="font-display text-2xl font-bold text-glow-diya">{r.result_digit}</div>
          </div>
        ))}
        {recent.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-6">No rounds declared yet.</div>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Your last bets</h2>
        <div className="space-y-2">
          {myBets.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary font-bold">{b.digit}</span>
                <span className="text-muted-foreground">₹{b.amount}</span>
              </div>
              <span className={
                b.status === "WON" ? "text-primary font-semibold" :
                b.status === "LOST" ? "text-muted-foreground" : "text-saffron"
              }>
                {b.status === "WON" ? `+₹${b.win_amount}` : b.status}
              </span>
            </div>
          ))}
          {myBets.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">No bets yet — place your first!</div>
          )}
        </div>
      </div>
    </div>
  );
}
