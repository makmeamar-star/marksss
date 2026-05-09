import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Zap, PlayCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/results/automation")({
  head: () => ({ meta: [{ title: "Result Automation — Admin" }] }),
  component: AutomationPage,
});

type Row = {
  market_id: string;
  open_enabled: boolean;
  close_enabled: boolean;
  grace_minutes: number;
  mode: string;
  last_run_at: string | null;
  market: { display_name: string; open_time: string; close_time: string; status: string };
};

function AutomationPage() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-automation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_automation")
        .select("*, market:markets!market_automation_market_id_fkey(display_name, open_time, close_time, status)")
        .order("market_id");
      if (error) {
        const fb = await supabase.from("market_automation").select("*").order("market_id");
        if (fb.error) throw fb.error;
        const mks = await supabase.from("markets").select("id, display_name, open_time, close_time, status");
        const map = new Map((mks.data ?? []).map((m) => [m.id, m]));
        return (fb.data ?? []).map((r) => ({ ...r, market: map.get(r.market_id) })) as Row[];
      }
      return (data ?? []) as unknown as Row[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-automation-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "market_automation" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-automation"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  async function update(
    market_id: string,
    patch: { open_enabled?: boolean; close_enabled?: boolean; grace_minutes?: number },
  ) {
    const { error } = await supabase.from("market_automation").update(patch).eq("market_id", market_id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-automation"] });
  }

  async function runNow() {
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc("run_due_auto_declarations");
      if (error) throw error;
      const ran = (data as { ran?: number } | null)?.ran ?? 0;
      toast.success(ran > 0 ? `Auto-declared ${ran} session${ran > 1 ? "s" : ""}` : "Nothing due right now");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <nav className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
            <Link to="/admin" className="hover:text-foreground inline-flex items-center gap-1">
              <ChevronLeft className="h-3 w-3" /> Admin
            </Link>
          </nav>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Zap className="h-7 w-7 text-primary" /> Result Automation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle automatic result declaration per market. The scheduler runs every minute and picks a random valid pana
            for any enabled session whose result time has passed. Admins can still correct results within 10 minutes.
          </p>
        </div>
        <Button onClick={runNow} disabled={running} className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Run scheduler now
        </Button>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Market</th>
                <th className="text-left p-3">Times (IST)</th>
                <th className="text-center p-3">Auto OPEN</th>
                <th className="text-center p-3">Auto CLOSE</th>
                <th className="text-center p-3">Grace (min)</th>
                <th className="text-left p-3">Last run</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={row.market_id} className="border-t">
                  <td className="p-3 font-medium">{row.market?.display_name ?? row.market_id}</td>
                  <td className="p-3 text-muted-foreground">
                    {row.market?.open_time} → {row.market?.close_time}
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={row.open_enabled}
                      onCheckedChange={(v) => update(row.market_id, { open_enabled: v })}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={row.close_enabled}
                      onCheckedChange={(v) => update(row.market_id, { close_enabled: v })}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      value={row.grace_minutes}
                      onChange={(e) => update(row.market_id, { grace_minutes: Number(e.target.value) || 0 })}
                      className="w-20 mx-auto text-center"
                    />
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {row.last_run_at ? new Date(row.last_run_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">How it works</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>A scheduled job calls the auto-declare endpoint every minute.</li>
          <li>For each enabled market & session, if the IST result time + grace has passed and no manual result exists, a random valid pana is picked.</li>
          <li>Bets are settled exactly like a manual declaration; users get win/loss notifications.</li>
          <li>Admins can override within 10 minutes from the Declare/Correction screen.</li>
        </ul>
      </div>
    </div>
  );
}
