import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Star, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_authenticated/starline")({
  head: () => ({
    meta: [
      { title: "Starline — SattaKing Pro" },
      { name: "description", content: "12 quick Starline rounds every day. Pick a digit, win 9×." },
    ],
  }),
  component: StarlinePage,
});

type Round = {
  id: string; round_no: number; opens_at: string; closes_at: string;
  declared_at: string | null; result_digit: number | null; status: string; payout_multiplier: number;
};

function StarlinePage() {
  const refresh = useAuthStore((s) => s.refreshProfile);
  const balance = useAuthStore((s) => s.user?.balance ?? 0);
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const { data: rounds } = useQuery({
    queryKey: ["starline-rounds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_rounds")
        .select("*")
        .eq("category", "STARLINE")
        .gte("opens_at", new Date(Date.now() - 12 * 3600 * 1000).toISOString())
        .order("opens_at");
      if (error) throw error;
      return (data ?? []) as Round[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("starline-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "quick_rounds" },
        () => qc.invalidateQueries({ queryKey: ["starline-rounds"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const next = rounds?.find((r) => r.status === "OPEN" && new Date(r.closes_at).getTime() > now)
    ?? rounds?.find((r) => new Date(r.opens_at).getTime() > now);
  const past = rounds?.filter((r) => r.status === "DECLARED").reverse().slice(0, 8) ?? [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Star className="h-7 w-7 text-primary" /> Starline
        </h1>
        <p className="text-sm text-muted-foreground">12 quick rounds daily, 10 AM – 9 PM IST. Pick 0–9, win 9×.</p>
      </header>

      {next ? <RoundCard round={next} now={now} onPlaced={() => { refresh(); }} balance={balance} />
        : <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">No upcoming Starline rounds today.</div>}

      <div className="glass rounded-xl p-4">
        <h3 className="font-display text-lg font-bold mb-3">Recent results</h3>
        {past.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No declared rounds yet.</p>}
        <ul className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {past.map((r) => (
            <li key={r.id} className="rounded-md border border-border/50 bg-surface/60 p-2 text-center">
              <div className="text-[10px] text-muted-foreground">#{r.round_no}</div>
              <div className="font-mono text-2xl font-bold text-primary">{r.result_digit}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(rounds ?? []).filter((r) => r.status !== "DECLARED").slice(0, 12).map((r) => (
          <div key={r.id} className="rounded-md border border-border/40 px-2 py-1.5 text-center text-xs">
            <div className="text-muted-foreground">#{r.round_no}</div>
            <div className="font-mono">{new Date(r.opens_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundCard({ round, now, onPlaced, balance }: { round: Round; now: number; onPlaced: () => void; balance: number }) {
  const [digit, setDigit] = useState<number | null>(null);
  const [amount, setAmount] = useState("50");
  const open = round.status === "OPEN" && new Date(round.opens_at).getTime() <= now && new Date(round.closes_at).getTime() > now;
  const ms = Math.max(0, new Date(open ? round.closes_at : round.opens_at).getTime() - now);
  const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
  const ss = String(Math.floor((ms / 1000) % 60)).padStart(2, "0");

  const place = useMutation({
    mutationFn: async () => {
      if (digit === null) throw new Error("Pick a digit");
      const n = Number(amount);
      if (!n || n < 10) throw new Error("Min ₹10");
      if (n > balance) throw new Error("Insufficient balance");
      const { data, error } = await supabase.rpc("place_quick_bet", {
        p_round_id: round.id, p_digit: digit, p_amount: n,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success(`Bet placed on ${digit}`); setDigit(null); onPlaced(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="glass-gold rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Round #{round.round_no}</div>
          <div className="font-display text-xl font-bold">{open ? "Closes in" : "Opens in"}</div>
        </div>
        <div className="font-mono text-3xl font-bold text-primary flex items-center gap-1">
          <Timer className="h-5 w-5" />{mm}:{ss}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {[0,1,2,3,4,5,6,7,8,9].map((d) => (
          <button
            key={d}
            type="button"
            disabled={!open}
            onClick={() => setDigit(d)}
            className={`aspect-square rounded-lg border font-mono text-2xl font-bold transition ${
              digit === d ? "border-primary bg-primary/20 text-primary" : "border-border/60 hover:border-primary/50"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount (₹)</label>
          <Input type="number" min={10} max={5000} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!open} />
        </div>
        <Button onClick={() => place.mutate()} disabled={!open || digit === null || place.isPending} className="h-10 px-6">
          {place.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Win ₹${(Number(amount) * round.payout_multiplier).toLocaleString("en-IN")}`}
        </Button>
      </div>
    </div>
  );
}
