import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { HardOverrideDialog, type HardOverrideRow } from "@/components/admin/declare/HardOverrideDialog";

export const Route = createFileRoute("/admin/results/history")({
  head: () => ({ meta: [{ title: "Result History — Admin" }] }),
  component: ResultHistory,
});

type Row = {
  id: string;
  market_id: string;
  session_date: string;
  open_pana: string | null;
  open_digit: number | null;
  close_pana: string | null;
  close_digit: number | null;
  jodi: string | null;
  status: string;
  declared_at: string | null;
  declared_by: string | null;
};

function ResultHistory() {
  const [marketId, setMarketId] = useState<string>("ALL");
  const [days, setDays] = useState<number>(30);
  const [search, setSearch] = useState("");
  const [overriding, setOverriding] = useState<HardOverrideRow | null>(null);

  const { data: markets } = useQuery({
    queryKey: ["admin-markets-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("markets")
        .select("id, display_name")
        .order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["result-history", marketId, days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      let q = supabase
        .from("market_results")
        .select("*")
        .gte("session_date", since.toISOString().slice(0, 10))
        .order("session_date", { ascending: false })
        .order("market_id")
        .limit(1000);
      if (marketId !== "ALL") q = q.eq("market_id", marketId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.market_id.toLowerCase().includes(s) ||
      (r.open_pana ?? "").includes(s) ||
      (r.close_pana ?? "").includes(s) ||
      (r.jodi ?? "").includes(s),
    );
  }, [rows, search]);

  const marketName = (id: string) =>
    markets?.find((m) => m.id === id)?.display_name ?? id;

  function exportCsv() {
    const header = "session_date,market,open_pana,open_digit,close_pana,close_digit,jodi,status,declared_at\n";
    const body = filtered.map((r) =>
      [
        r.session_date,
        `"${marketName(r.market_id)}"`,
        r.open_pana ?? "",
        r.open_digit ?? "",
        r.close_pana ?? "",
        r.close_digit ?? "",
        r.jodi ?? "",
        r.status,
        r.declared_at ?? "",
      ].join(","),
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-5">
      <Link to="/admin/results/declare" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Declare
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Result History</h1>
          <p className="text-sm text-muted-foreground">All declared results across markets and sessions.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </header>

      <div className="glass rounded-xl p-4 grid sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Market</label>
          <Select value={marketId} onValueChange={setMarketId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All markets</SelectItem>
              {markets?.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Time range</label>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 365 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="pana, jodi, market…" className="pl-9" />
          </div>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Market</th>
              <th className="px-4 py-3">Open</th>
              <th className="px-4 py-3">Jodi</th>
              <th className="px-4 py-3">Close</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Declared</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No results.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="hover:bg-surface/40">
                <td className="px-4 py-3 whitespace-nowrap">{r.session_date}</td>
                <td className="px-4 py-3">{marketName(r.market_id)}</td>
                <td className="px-4 py-3 font-mono">
                  {r.open_pana ? `${r.open_pana}-${r.open_digit}` : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-primary">
                  {r.jodi ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 font-mono">
                  {r.close_pana ? `${r.close_digit}-${r.close_pana}` : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === "DECLARED" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {r.declared_at ? new Date(r.declared_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-muted-foreground text-right">{filtered.length} rows</div>
    </div>
  );
}
