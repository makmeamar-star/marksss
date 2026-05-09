import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ChevronLeft, History, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/results/automation-runs")({
  head: () => ({ meta: [{ title: "Automation Runs — Admin" }] }),
  component: RunsPage,
});

type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  market_id: string | null;
  session_date: string | null;
  session: string | null;
  pana: string | null;
  reason: string | null;
  metadata: { winners?: number; losers?: number; payout?: number; digit?: number } | null;
};

function RunsPage() {
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-automation-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("action", "AUTO_DECLARE")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-auto-runs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log", filter: "action=eq.AUTO_DECLARE" },
        () => qc.invalidateQueries({ queryKey: ["admin-automation-runs"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const grouped = groupByMinute(data ?? []);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <nav className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
            <Link to="/admin" className="hover:text-foreground inline-flex items-center gap-1">
              <ChevronLeft className="h-3 w-3" /> Admin
            </Link>
            <span>/</span>
            <Link to="/admin/results/automation" className="hover:text-foreground">Automation</Link>
          </nav>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <History className="h-7 w-7 text-primary" /> Automation Runs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recent auto-declaration activity. Each row is one session settled by the scheduler.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No automated declarations yet. Enable a market on the Automation page; the scheduler runs every minute.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((grp) => (
            <section key={grp.key} className="rounded-2xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/40 text-xs">
                <span className="font-medium">{new Date(grp.at).toLocaleString()}</span>
                <Badge variant="secondary">
                  {grp.rows.length} session{grp.rows.length > 1 ? "s" : ""}
                </Badge>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Market</th>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Session</th>
                    <th className="text-left p-3">Pana</th>
                    <th className="text-center p-3">Digit</th>
                    <th className="text-center p-3">Winners</th>
                    <th className="text-center p-3">Losers</th>
                    <th className="text-right p-3">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {grp.rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3 font-medium">{r.market_id ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{r.session_date ?? "—"}</td>
                      <td className="p-3">
                        <Badge variant={r.session === "OPEN" ? "default" : "outline"}>{r.session}</Badge>
                      </td>
                      <td className="p-3 font-mono">{r.pana ?? "—"}</td>
                      <td className="p-3 text-center font-mono">{r.metadata?.digit ?? "—"}</td>
                      <td className="p-3 text-center text-emerald-500">{r.metadata?.winners ?? 0}</td>
                      <td className="p-3 text-center text-muted-foreground">{r.metadata?.losers ?? 0}</td>
                      <td className="p-3 text-right font-mono">
                        ₹{Number(r.metadata?.payout ?? 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByMinute(rows: AuditRow[]) {
  const map = new Map<string, { key: string; at: string; rows: AuditRow[] }>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    d.setSeconds(0, 0);
    const key = d.toISOString();
    if (!map.has(key)) map.set(key, { key, at: key, rows: [] });
    map.get(key)!.rows.push(r);
  }
  return Array.from(map.values());
}
