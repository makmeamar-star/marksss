import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export function PromoRedeemCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const { data: active } = useQuery({
    queryKey: ["promo-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("promo_codes")
        .select("code, description, bonus_amount, min_deposit, expires_at")
        .order("bonus_amount", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["promo-mine", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("promo_redemptions")
        .select("code, bonus_amount, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const redeem = useMutation({
    mutationFn: async (c: string) => {
      const { data, error } = await supabase.rpc("redeem_promo_code", { _code: c.toUpperCase().trim() });
      if (error) throw error;
      return data as { ok: boolean; bonus: number; code: string };
    },
    onSuccess: (r) => {
      toast.success(`Bonus ₹${r.bonus} credited (${r.code})`);
      setCode("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message.replace(/^.*?:\s*/, "")),
  });

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-primary" />
        <h3 className="font-display text-lg font-bold">Promo & Bonus</h3>
      </div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ENTER CODE"
          maxLength={32}
          className="font-mono uppercase"
        />
        <Button onClick={() => redeem.mutate(code)} disabled={!code || redeem.isPending}>
          {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redeem"}
        </Button>
      </div>

      {active && active.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Active offers</div>
          {active.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => setCode(p.code)}
              className="w-full text-left flex items-center justify-between rounded-md border border-border/60 px-3 py-2 hover:border-primary/50 transition"
            >
              <div className="min-w-0">
                <div className="font-mono text-sm font-bold">{p.code}</div>
                {p.description && <div className="text-xs text-muted-foreground truncate">{p.description}</div>}
              </div>
              <div className="flex items-center gap-1 text-primary font-mono text-sm shrink-0">
                <Sparkles className="h-3 w-3" />₹{Number(p.bonus_amount).toLocaleString("en-IN")}
              </div>
            </button>
          ))}
        </div>
      )}

      {mine && mine.length > 0 && (
        <div className="pt-2 border-t border-border/40">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Your redemptions</div>
          <ul className="text-xs space-y-0.5">
            {mine.map((m, i) => (
              <li key={i} className="flex justify-between">
                <span className="font-mono">{m.code}</span>
                <span className="text-emerald-400">+₹{Number(m.bonus_amount).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CashbackCard({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["cashback-mine", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("cashback_runs")
        .select("run_date, cashback_amount, loss_amount, rate")
        .eq("user_id", userId)
        .order("run_date", { ascending: false })
        .limit(7);
      return data ?? [];
    },
  });

  const total = (data ?? []).reduce((s, r) => s + Number(r.cashback_amount), 0);

  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Daily Cashback</h3>
        <span className="text-xs text-muted-foreground">5% on net losses</span>
      </div>
      <div className="font-mono text-2xl font-bold text-emerald-400">
        ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </div>
      <div className="text-xs text-muted-foreground">Last 7 days</div>
      {data && data.length > 0 ? (
        <ul className="text-xs space-y-0.5 pt-2 border-t border-border/40">
          {data.map((r) => (
            <li key={r.run_date} className="flex justify-between">
              <span>{new Date(r.run_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
              <span className="text-emerald-400">+₹{Number(r.cashback_amount).toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No cashback yet — play tomorrow to qualify.</p>
      )}
    </div>
  );
}
