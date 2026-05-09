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
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10_000,
  });

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
