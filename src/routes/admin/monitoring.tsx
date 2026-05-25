import { callAdminHook } from "@/lib/callAdminHook";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Wifi, WifiOff, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/monitoring")({
  component: MonitoringPage,
});

type Alert = {
  id: string;
  source: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string | null;
  context: any;
  resolved_at: string | null;
  created_at: string;
};
type ScrapeLog = {
  id: string;
  market_id: string;
  session: string;
  source: string;
  status: string;
  pana: string | null;
  error: string | null;
  run_at: string;
};

function MonitoringPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const [rtState, setRtState] = useState<"connecting" | "live" | "down">("connecting");
  const [lastEvent, setLastEvent] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase.from("system_alerts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("result_scrape_log").select("*").order("run_at", { ascending: false }).limit(200),
    ]);
    setAlerts((a ?? []) as Alert[]);
    setLogs((l ?? []) as ScrapeLog[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Realtime probe — subscribe to market_results changes
  useEffect(() => {
    const channel = supabase
      .channel("monitoring-probe")
      .on("postgres_changes", { event: "*", schema: "public", table: "market_results" }, () => {
        setLastEvent(new Date());
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRtState("live");
        else if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") setRtState("down");
      });
    const t = setTimeout(() => setRtState((s) => (s === "connecting" ? "down" : s)), 8000);
    return () => { clearTimeout(t); supabase.removeChannel(channel); };
  }, []);

  async function runHealthCheck() {
    setRunning(true);
    try {
      const res = await callAdminHook("/api/public/hooks/health-check", { method: "POST" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "failed");
      toast.success(`Health check ran. ${j.alertsInserted} new alert(s).`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  async function resolve(id: string) {
    const { error } = await supabase
      .from("system_alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Resolved"); load(); }
  }

  const open = useMemo(() => alerts.filter((a) => !a.resolved_at), [alerts]);
  const resolved = useMemo(() => alerts.filter((a) => a.resolved_at), [alerts]);

  const stats = useMemo(() => {
    const last100 = logs.slice(0, 100);
    const ok = last100.filter((l) => l.status === "OK").length;
    const errs = last100.filter((l) => l.status === "FETCH_ERROR" || l.status === "RPC_ERROR").length;
    const notYet = last100.filter((l) => l.status === "NOT_YET").length;
    return { ok, errs, notYet, total: last100.length };
  }, [logs]);

  return (
    <div className="container mx-auto px-6 py-10 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Scraper health, missing-result alerts, and realtime channel status.
          </p>
        </div>
        <Button onClick={runHealthCheck} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          Run Health Check
        </Button>
      </div>

      {/* Top stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open Alerts" value={open.length} highlight={open.length > 0 ? "critical" : "ok"} />
        <StatCard label="Scrape OK (last 100)" value={`${stats.ok}/${stats.total}`} highlight={stats.errs > stats.total * 0.3 ? "warning" : "ok"} />
        <StatCard label="Scrape Errors (last 100)" value={stats.errs} highlight={stats.errs > 5 ? "warning" : "ok"} />
        <RealtimeCard state={rtState} lastEvent={lastEvent} />
      </div>

      {/* Open alerts */}
      <h2 className="mt-8 font-display text-xl font-semibold flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" /> Active Alerts
      </h2>
      <div className="mt-3 space-y-2">
        {open.length === 0 && (
          <div className="rounded-xl border border-border/60 px-4 py-6 text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" /> All systems nominal.
          </div>
        )}
        {open.map((a) => (
          <div key={a.id} className="rounded-xl border border-border/60 px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={a.severity} />
                <span className="text-xs text-muted-foreground">{a.source}</span>
                <span className="font-semibold">{a.title}</span>
              </div>
              {a.message && <p className="text-sm text-muted-foreground mt-1">{a.message}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => resolve(a.id)}>Resolve</Button>
          </div>
        ))}
      </div>

      {/* Recent scrape log */}
      <h2 className="mt-8 font-display text-xl font-semibold flex items-center gap-2">
        <Activity className="h-5 w-5" /> Recent Scrape Activity
      </h2>
      <div className="mt-3 rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Market</th>
                <th className="text-left px-4 py-2">Session</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Pana</th>
                <th className="text-left px-4 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No scrape activity yet.</td></tr>
              )}
              {logs.slice(0, 100).map((l) => (
                <tr key={l.id} className="border-t border-border/60">
                  <td className="px-4 py-2 text-xs whitespace-nowrap">{new Date(l.run_at).toLocaleTimeString()}</td>
                  <td className="px-4 py-2 text-xs">{l.market_id}</td>
                  <td className="px-4 py-2 text-xs">{l.session}</td>
                  <td className="px-4 py-2"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-2 font-mono text-xs">{l.pana ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-destructive max-w-xs truncate" title={l.error ?? ""}>{l.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolved alerts */}
      {resolved.length > 0 && (
        <>
          <h2 className="mt-8 font-display text-xl font-semibold text-muted-foreground">Resolved</h2>
          <div className="mt-3 space-y-1.5">
            {resolved.slice(0, 10).map((a) => (
              <div key={a.id} className="rounded-lg border border-border/40 px-3 py-2 text-xs flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="font-medium text-foreground">{a.title}</span>
                <span>· {a.source}</span>
                <span className="ml-auto">{new Date(a.resolved_at!).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: any; highlight: "ok" | "warning" | "critical" }) {
  const tone =
    highlight === "critical" ? "border-destructive/40 bg-destructive/5" :
    highlight === "warning" ? "border-amber-500/40 bg-amber-500/5" :
    "border-border/60";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function RealtimeCard({ state, lastEvent }: { state: "connecting" | "live" | "down"; lastEvent: Date | null }) {
  const tone =
    state === "live" ? "border-green-500/40 bg-green-500/5" :
    state === "down" ? "border-destructive/40 bg-destructive/5" :
    "border-border/60";
  const Icon = state === "live" ? Wifi : WifiOff;
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <Icon className="h-3 w-3" /> Realtime Channel
      </div>
      <div className="text-lg font-bold mt-1 capitalize">{state}</div>
      <div className="text-[11px] text-muted-foreground">
        {lastEvent ? `last event ${lastEvent.toLocaleTimeString()}` : "no events yet"}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === "critical" ? "bg-destructive text-destructive-foreground" :
    severity === "warning" ? "bg-amber-500 text-background" :
    "bg-muted text-foreground";
  return <Badge className={cls}>{severity}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "OK" ? "bg-green-500/15 text-green-500" :
    status === "SKIPPED_DECLARED" ? "bg-muted text-muted-foreground" :
    status === "NOT_YET" ? "bg-amber-500/15 text-amber-600" :
    "bg-destructive/15 text-destructive";
  return <span className={`text-[10px] px-2 py-0.5 rounded ${tone}`}>{status}</span>;
}
