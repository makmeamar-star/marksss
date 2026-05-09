import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, RefreshCw, Filter as FilterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listBets, exportBetsCsv } from "@/lib/adminBets.functions";

export const Route = createFileRoute("/admin/bets")({
  component: AdminBetsPage,
});

const inr = (n: number | null | undefined) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const BET_TYPES = [
  "ALL", "SINGLE_OPEN", "SINGLE_CLOSE", "JODI",
  "SINGLE_PANA", "DOUBLE_PANA", "TRIPLE_PANA",
  "HALF_SANGAM", "FULL_SANGAM",
];

type Filters = {
  search: string;
  marketId: string;
  session: "ALL" | "OPEN" | "CLOSE";
  status: "ALL" | "PENDING" | "WON" | "LOST";
  betType: string; // "ALL" or specific
  fromDate: string;
  toDate: string;
  minAmount: string;
  maxAmount: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function AdminBetsPage() {
  const list = useServerFn(listBets);
  const exportFn = useServerFn(exportBetsCsv);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [filters, setFilters] = useState<Filters>({
    search: "",
    marketId: "",
    session: "ALL",
    status: "ALL",
    betType: "ALL",
    fromDate: today(),
    toDate: today(),
    minAmount: "",
    maxAmount: "",
  });
  const [markets, setMarkets] = useState<{ id: string; display_name: string }[]>([]);

  useEffect(() => {
    supabase
      .from("markets")
      .select("id, display_name")
      .order("display_name")
      .then(({ data }) => setMarkets(data ?? []));
  }, []);

  const queryInput = useMemo(
    () => ({
      search: filters.search,
      marketId: filters.marketId,
      session: filters.session,
      status: filters.status,
      betType: filters.betType === "ALL" ? "" : filters.betType,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      minAmount: filters.minAmount ? Number(filters.minAmount) : null,
      maxAmount: filters.maxAmount ? Number(filters.maxAmount) : null,
      page,
      pageSize,
    }),
    [filters, page]
  );

  const q = useQuery({
    queryKey: ["admin", "bets", queryInput],
    queryFn: () => list({ data: queryInput }),
    refetchInterval: 15_000,
  });

  // Realtime: bump on bet inserts/updates
  useEffect(() => {
    const ch = supabase
      .channel("admin-bets-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "bets"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const agg = q.data?.agg;

  // Client-side username search filter (search applies to current page)
  const visibleRows = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const s = filters.search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) =>
      String(r.username).toLowerCase().includes(s) ||
      String(r.email ?? "").toLowerCase().includes(s) ||
      String(r.bet_number).toLowerCase().includes(s)
    );
  }, [q.data, filters.search]);

  const onExport = async () => {
    try {
      const res = await exportFn({ data: queryInput });
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bets_${today()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.count} bets`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    }
  };

  const reset = () => {
    setFilters({
      search: "", marketId: "", session: "ALL", status: "ALL", betType: "ALL",
      fromDate: today(), toDate: today(), minAmount: "", maxAmount: "",
    });
    setPage(1);
  };

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Bets Monitor</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Live bet activity with risk exposure and CSV export.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${q.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 rounded-2xl glass-gold p-4">
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <FilterIcon className="h-4 w-4" /> Filters
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={reset}>
            Reset
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Field label="Search">
            <Input
              placeholder="user / number"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
            />
          </Field>
          <Field label="Market">
            <Select value={filters.marketId || "ALL"} onValueChange={(v) => set("marketId", v === "ALL" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All markets</SelectItem>
                {markets.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Session">
            <Select value={filters.session} onValueChange={(v) => set("session", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLOSE">Close</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filters.status} onValueChange={(v) => set("status", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="WON">Won</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bet type">
            <Select value={filters.betType} onValueChange={(v) => set("betType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BET_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t === "ALL" ? "All types" : t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="From date">
            <Input type="date" value={filters.fromDate} onChange={(e) => set("fromDate", e.target.value)} />
          </Field>
          <Field label="To date">
            <Input type="date" value={filters.toDate} onChange={(e) => set("toDate", e.target.value)} />
          </Field>
          <Field label="Min ₹">
            <Input type="number" min={0} value={filters.minAmount} onChange={(e) => set("minAmount", e.target.value)} />
          </Field>
          <Field label="Max ₹">
            <Input type="number" min={0} value={filters.maxAmount} onChange={(e) => set("maxAmount", e.target.value)} />
          </Field>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Bets" value={String(agg?.count ?? 0)} />
        <Kpi label="Volume" value={inr(agg?.totalAmount)} />
        <Kpi label="Pending" value={String(agg?.pending ?? 0)} />
        <Kpi label="Pending exposure" value={inr(agg?.pendingExposure)} tone="warn" />
        <Kpi label="Payout" value={inr(agg?.totalWin)} tone="bad" />
        <Kpi label="Net (House)" value={inr((agg?.totalAmount ?? 0) - (agg?.totalWin ?? 0))} tone="good" />
      </div>

      {/* Table */}
      <div className="mt-4 rounded-2xl glass-gold overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead className="text-xs text-muted-foreground bg-background/30">
              <tr className="text-left">
                <th className="px-3 py-2.5 font-medium">Time</th>
                <th className="px-3 py-2.5 font-medium">User</th>
                <th className="px-3 py-2.5 font-medium">Market</th>
                <th className="px-3 py-2.5 font-medium">Session</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Number</th>
                <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                <th className="px-3 py-2.5 font-medium text-right">Payout</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((b: any) => (
                <tr key={b.id} className="border-t border-border/40 hover:bg-background/40">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(b.created_at).toLocaleString("en-IN", { hour12: false })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium truncate max-w-[160px]">{b.username}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{b.market_id}</td>
                  <td className="px-3 py-2 text-xs">{b.session}</td>
                  <td className="px-3 py-2 font-mono text-xs">{b.bet_type}</td>
                  <td className="px-3 py-2 font-mono">{b.bet_number}</td>
                  <td className="px-3 py-2 text-right font-mono">{inr(b.amount)}</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-400">
                    {b.win_amount != null ? inr(b.win_amount) : `×${b.payout}`}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={b.status} />
                  </td>
                </tr>
              ))}
              {!q.isLoading && visibleRows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">No bets match these filters.</td></tr>
              )}
            </tbody>
            {agg && (
              <tfoot>
                <tr className="border-t border-border/60 bg-background/40 font-medium">
                  <td colSpan={6} className="px-3 py-2.5 text-xs text-muted-foreground">
                    Page totals across {agg.count} matching bet{agg.count === 1 ? "" : "s"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{inr(agg.totalAmount)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-400">{inr(agg.totalWin)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {agg.pending}P · {agg.won}W · {agg.lost}L
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-border/40">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  const color =
    tone === "good" ? "text-emerald-400"
    : tone === "bad" ? "text-destructive"
    : tone === "warn" ? "text-amber-400"
    : "text-foreground";
  return (
    <div className="rounded-xl glass-gold px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-mono font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "WON"
      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
      : status === "LOST"
      ? "border-border text-muted-foreground bg-background/40"
      : "border-primary/40 text-primary bg-primary/10";
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{status}</span>;
}
