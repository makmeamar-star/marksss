import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, FileSearch, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  market: fallback(z.string(), "").default(""),
  date: fallback(z.string(), "").default(""), // YYYY-MM-DD
  session: fallback(z.enum(["", "OPEN", "CLOSE"]), "").default(""),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/admin/results/automation-audit")({
  head: () => ({ meta: [{ title: "Automation Audit — Admin" }] }),
  validateSearch: zodValidator(searchSchema),
  component: AuditPage,
});

type AuditRow = {
  id: string;
  created_at: string;
  market_id: string | null;
  session_date: string | null;
  session: string | null;
  pana: string | null;
  reason: string | null;
  metadata: { winners?: number; losers?: number; payout?: number; digit?: number } | null;
};

function AuditPage() {
  const { market, date, session, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/results/automation-audit" });
  const qc = useQueryClient();
  const [qLocal, setQLocal] = useState(q);

  // Debounce free-text search into URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (qLocal !== q) navigate({ search: (p) => ({ ...p, q: qLocal }) });
    }, 300);
    return () => clearTimeout(t);
  }, [qLocal, q, navigate]);

  const { data: markets } = useQuery({
    queryKey: ["audit-markets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("markets").select("id, display_name").order("display_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-auto-audit", market, date, session],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("*")
        .eq("action", "AUTO_DECLARE")
        .order("created_at", { ascending: false })
        .limit(500);
      if (market) query = query.eq("market_id", market);
      if (date) query = query.eq("session_date", date);
      if (session) query = query.eq("session", session);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-auto-audit-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log", filter: "action=eq.AUTO_DECLARE" },
        () => qc.invalidateQueries({ queryKey: ["admin-auto-audit"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const filtered = useMemo(() => {
    if (!q) return data ?? [];
    const needle = q.toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (r.market_id ?? "").toLowerCase().includes(needle) ||
        (r.pana ?? "").toLowerCase().includes(needle) ||
        (r.session_date ?? "").toLowerCase().includes(needle) ||
        String(r.metadata?.digit ?? "").includes(needle),
    );
  }, [data, q]);

  const clearAll = () => {
    setQLocal("");
    navigate({ search: () => ({ market: "", date: "", session: "", q: "" }) });
  };
  const hasFilters = market || date || session || q;

  const dateObj = date ? new Date(date + "T00:00:00") : undefined;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
      <header>
        <nav className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <Link to="/admin" className="hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft className="h-3 w-3" /> Admin
          </Link>
          <span>/</span>
          <Link to="/admin/results/automation" className="hover:text-foreground">Automation</Link>
        </nav>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <FileSearch className="h-7 w-7 text-primary" /> Automation Audit
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Searchable trail of every AUTO_DECLARE action. Filters update the URL — share or bookmark a view.
        </p>
      </header>

      {/* Filters */}
      <div className="rounded-2xl border bg-card p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Search</label>
          <Input
            placeholder="Market, pana, digit…"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Market</label>
          <Select
            value={market || "__all"}
            onValueChange={(v) => navigate({ search: (p) => ({ ...p, market: v === "__all" ? "" : v }) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All markets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All markets</SelectItem>
              {(markets ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Session date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start font-normal", !dateObj && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateObj ? format(dateObj, "PPP") : "Any date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateObj}
                onSelect={(d) =>
                  navigate({ search: (p) => ({ ...p, date: d ? format(d, "yyyy-MM-dd") : "" }) })
                }
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Session</label>
          <Select
            value={session || "__all"}
            onValueChange={(v) =>
              navigate({ search: (p) => ({ ...p, session: v === "__all" ? "" : (v as "OPEN" | "CLOSE") }) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Both" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Both</SelectItem>
              <SelectItem value="OPEN">OPEN</SelectItem>
              <SelectItem value="CLOSE">CLOSE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2 lg:col-span-5 flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {hasFilters ? (
              <Button size="sm" variant="ghost" onClick={clearAll} className="h-7 gap-1">
                <X className="h-3 w-3" /> Clear filters
              </Button>
            ) : (
              <span>Showing latest 500 events.</span>
            )}
            <span>· {filtered.length} match{filtered.length === 1 ? "" : "es"}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1">
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No matching events.
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Market</th>
                <th className="text-left p-3">Session date</th>
                <th className="text-left p-3">Session</th>
                <th className="text-left p-3">Pana</th>
                <th className="text-center p-3">Digit</th>
                <th className="text-center p-3">Won / Lost</th>
                <th className="text-right p-3">Payout</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">{r.market_id ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.session_date ?? "—"}</td>
                  <td className="p-3">
                    <Badge variant={r.session === "OPEN" ? "default" : "outline"}>{r.session}</Badge>
                  </td>
                  <td className="p-3 font-mono">{r.pana ?? "—"}</td>
                  <td className="p-3 text-center font-mono">{r.metadata?.digit ?? "—"}</td>
                  <td className="p-3 text-center text-xs">
                    <span className="text-emerald-500">{r.metadata?.winners ?? 0}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-muted-foreground">{r.metadata?.losers ?? 0}</span>
                  </td>
                  <td className="p-3 text-right font-mono">
                    ₹{Number(r.metadata?.payout ?? 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
