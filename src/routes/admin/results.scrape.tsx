import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/results/scrape")({
  component: ScrapePage,
});

function ScrapePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const logs = useQuery({
    queryKey: ["scrape-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("result_scrape_log")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  const all = logs.data ?? [];
  const lastRunAt = all[0]?.run_at ?? null;
  const last24h = all.filter(
    (r: any) => Date.now() - new Date(r.run_at).getTime() < 24 * 3600 * 1000,
  );
  const okCount = last24h.filter((r: any) => r.status === "OK").length;
  const skippedCount = last24h.filter((r: any) => r.status === "SKIPPED_DECLARED").length;
  const notYetCount = last24h.filter((r: any) => r.status === "NOT_YET").length;
  const errorCount = last24h.filter((r: any) =>
    ["RPC_ERROR", "FETCH_ERROR", "INVALID_PANA"].includes(r.status),
  ).length;

  // Latest attempt per (market, session)
  const perMarket = new Map<string, any>();
  for (const r of all) {
    const k = `${r.market_id}|${r.session}`;
    if (!perMarket.has(k)) perMarket.set(k, r);
  }
  const perMarketRows = Array.from(perMarket.values()).sort(
    (a, b) => a.market_id.localeCompare(b.market_id) || a.session.localeCompare(b.session),
  );

  const runLive = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/public/hooks/scrape-results", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`Scraper ran. Processed ${d.count ?? 0} attempts.`);
      logs.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const backfill = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/public/hooks/backfill-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: from || undefined, to: to || undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`Backfill complete. Wrote ${d.written ?? 0} rows.`);
      if (d.errors?.length) console.warn("backfill errors", d.errors);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto px-6 py-12 max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Result Scraper</h1>
        <p className="text-muted-foreground mt-1">
          Pull real Open/Close panas from dpboss and other matka sources. Live runs
          auto-settle bets.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <StatTile label="Last run" value={lastRunAt ? timeAgo(lastRunAt) : "Never"} />
        <StatTile label="OK (24h)" value={okCount} tone="success" />
        <StatTile label="Skipped" value={skippedCount} />
        <StatTile label="Not yet" value={notYetCount} />
        <StatTile label="Errors (24h)" value={errorCount} tone={errorCount > 0 ? "error" : "muted"} />
      </div>

      <Card className="p-5">
        <div className="font-display text-lg font-bold mb-3">Per-market latest status</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2">Market</th>
                <th>Session</th>
                <th>Status</th>
                <th>Pana</th>
                <th>Source</th>
                <th>Last attempt</th>
              </tr>
            </thead>
            <tbody>
              {perMarketRows.map((r: any) => (
                <tr key={`${r.market_id}-${r.session}`} className="border-b border-border/40">
                  <td className="py-2 font-medium">{r.market_id}</td>
                  <td>{r.session}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.pana ?? "—"}</td>
                  <td className="text-xs text-muted-foreground">{r.source}</td>
                  <td className="text-xs text-muted-foreground">{timeAgo(r.run_at)}</td>
                </tr>
              ))}
              {!perMarketRows.length && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No attempts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="font-display text-lg font-bold">Live scrape (today)</div>
        <p className="text-sm text-muted-foreground">
          Fetches today's panel for every enabled market, calls system_auto_declare
          when a pana is published, and credits winners.
        </p>
        <Button onClick={() => runLive.mutate()} disabled={runLive.isPending}>
          {runLive.isPending ? "Running…" : "Run scraper now"}
        </Button>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="font-display text-lg font-bold">Backfill history</div>
        <p className="text-sm text-muted-foreground">
          Imports historical panas into market_results. Skips dates already declared.
          Does not re-settle bets.
        </p>
        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <Button onClick={() => backfill.mutate()} disabled={backfill.isPending}>
          {backfill.isPending ? "Backfilling…" : "Run backfill"}
        </Button>
      </Card>

      <Card className="p-5">
        <div className="font-display text-lg font-bold mb-3">Recent scrape attempts</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2">When</th>
                <th>Market</th>
                <th>Date</th>
                <th>Session</th>
                <th>Source</th>
                <th>Status</th>
                <th>Pana</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {(logs.data ?? []).map((r: any) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="py-2">{new Date(r.run_at).toLocaleString()}</td>
                  <td>{r.market_id}</td>
                  <td>{r.session_date}</td>
                  <td>{r.session}</td>
                  <td>{r.source}</td>
                  <td>{r.status}</td>
                  <td>{r.pana ?? "—"}</td>
                  <td className="text-destructive text-xs">{r.error ?? ""}</td>
                </tr>
              ))}
              {!logs.data?.length && (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No runs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatTile({ label, value, tone = "default" }: { label: string; value: any; tone?: "default" | "success" | "error" | "muted" }) {
  const toneCls =
    tone === "success" ? "text-emerald-500" :
    tone === "error" ? "text-destructive" :
    tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-xl glass-gold p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${toneCls}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OK: "bg-emerald-500/15 text-emerald-500",
    SKIPPED_DECLARED: "bg-muted text-muted-foreground",
    NOT_YET: "bg-amber-500/15 text-amber-500",
    RPC_ERROR: "bg-destructive/15 text-destructive",
    FETCH_ERROR: "bg-destructive/15 text-destructive",
    INVALID_PANA: "bg-destructive/15 text-destructive",
  };
  const cls = map[status] ?? "bg-muted text-muted-foreground";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
