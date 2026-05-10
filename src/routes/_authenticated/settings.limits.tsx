import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Clock, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/limits")({
  head: () => ({ meta: [{ title: "Play Limits — SattaKing Pro" }] }),
  component: LimitsPage,
});

function LimitsPage() {
  const qc = useQueryClient();
  const limits = useQuery({
    queryKey: ["user-limits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_limits").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const exclusions = useQuery({
    queryKey: ["self-exclusions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("self_exclusions")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [dailyBet, setDailyBet] = useState("");
  const [weeklyBet, setWeeklyBet] = useState("");
  const [dailyDeposit, setDailyDeposit] = useState("");
  const [sessionMin, setSessionMin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (limits.data) {
      setDailyBet(limits.data.daily_bet_limit?.toString() ?? "");
      setWeeklyBet(limits.data.weekly_bet_limit?.toString() ?? "");
      setDailyDeposit(limits.data.daily_deposit_limit?.toString() ?? "");
      setSessionMin(limits.data.session_minutes_limit?.toString() ?? "");
    }
  }, [limits.data]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("set_user_limits", {
      _daily_bet: dailyBet ? Number(dailyBet) : undefined,
      _weekly_bet: weeklyBet ? Number(weeklyBet) : undefined,
      _daily_deposit: dailyDeposit ? Number(dailyDeposit) : undefined,
      _session_min: sessionMin ? Number(sessionMin) : undefined,
      _reality_check_min: 30,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Limits saved");
    qc.invalidateQueries({ queryKey: ["user-limits"] });
  };

  const startCoolOff = async (kind: "COOLOFF_24H" | "COOLOFF_7D" | "COOLOFF_30D" | "EXCLUDE_PERMANENT") => {
    const label = kind === "EXCLUDE_PERMANENT" ? "permanently self-exclude" : `start a ${kind.replace("COOLOFF_", "").toLowerCase()} cool-off`;
    if (!confirm(`Are you sure you want to ${label}? This cannot be undone before the period ends.`)) return;
    const { error } = await supabase.rpc("start_self_exclusion", { _kind: kind });
    if (error) return toast.error(error.message);
    toast.success("Applied. Stay safe.");
    qc.invalidateQueries({ queryKey: ["self-exclusions"] });
    if (kind === "EXCLUDE_PERMANENT") setTimeout(() => (window.location.href = "/"), 1500);
  };

  const active = exclusions.data?.[0];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Play Limits</h1>
        <p className="text-sm text-muted-foreground">Stay in control. These limits are enforced server-side.</p>
      </header>

      {active && (
        <div className="glass rounded-xl p-5 border border-amber-500/40">
          <div className="flex items-start gap-3">
            <Ban className="h-5 w-5 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Active restriction: {active.kind}</p>
              {active.ends_at && (
                <p className="text-sm text-muted-foreground">Ends {new Date(active.ends_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl">Spending limits</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="db">Daily bet limit (₹)</Label>
            <Input id="db" type="number" min="0" value={dailyBet} onChange={(e) => setDailyBet(e.target.value)} placeholder="e.g. 2000" />
          </div>
          <div>
            <Label htmlFor="wb">Weekly bet limit (₹)</Label>
            <Input id="wb" type="number" min="0" value={weeklyBet} onChange={(e) => setWeeklyBet(e.target.value)} placeholder="e.g. 10000" />
          </div>
          <div>
            <Label htmlFor="dd">Daily deposit limit (₹)</Label>
            <Input id="dd" type="number" min="0" value={dailyDeposit} onChange={(e) => setDailyDeposit(e.target.value)} placeholder="e.g. 5000" />
          </div>
          <div>
            <Label htmlFor="sm">Session length (minutes)</Label>
            <Input id="sm" type="number" min="0" value={sessionMin} onChange={(e) => setSessionMin(e.target.value)} placeholder="e.g. 60" />
          </div>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save limits"}</Button>
      </section>

      <section className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl">Take a break</h2>
        </div>
        <p className="text-sm text-muted-foreground">During cool-off you cannot bet or deposit. The restriction lifts automatically.</p>
        <div className="grid gap-2 md:grid-cols-3">
          <Button variant="outline" onClick={() => startCoolOff("COOLOFF_24H")}>24 hours</Button>
          <Button variant="outline" onClick={() => startCoolOff("COOLOFF_7D")}>7 days</Button>
          <Button variant="outline" onClick={() => startCoolOff("COOLOFF_30D")}>30 days</Button>
        </div>
      </section>

      <section className="glass rounded-xl p-5 space-y-4 border border-destructive/30">
        <div className="flex items-center gap-2">
          <Ban className="h-5 w-5 text-destructive" />
          <h2 className="font-display text-xl">Self-exclude permanently</h2>
        </div>
        <p className="text-sm text-muted-foreground">Closes your account permanently. Balance is refunded after compliance checks.</p>
        <Button variant="destructive" onClick={() => startCoolOff("EXCLUDE_PERMANENT")}>Permanently self-exclude</Button>
      </section>

      <p className="text-xs text-muted-foreground text-center">
        Need help? Visit <Link to="/responsible-gaming" className="text-primary">Responsible Gaming</Link>.
      </p>
    </div>
  );
}
