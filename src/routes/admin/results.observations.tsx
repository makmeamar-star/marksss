import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, X, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listTodayObservations,
  approveObservation,
  rejectObservations,
} from "@/lib/scraperObservations.functions";

type SessionFilter = "ALL" | "OPEN" | "CLOSE" | "JODI";

export const Route = createFileRoute("/admin/results/observations")({
  component: ObservationsPage,
});

function ObservationsPage() {
  const fetchList = useServerFn(listTodayObservations);
  const approveFn = useServerFn(approveObservation);
  const rejectFn = useServerFn(rejectObservations);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin", "today-observations"],
    queryFn: () => fetchList(),
    refetchInterval: 20_000,
  });

  const approveMut = useMutation({
    mutationFn: (vars: { marketId: string; sessionDate: string; session: "OPEN" | "CLOSE" | "JODI"; value: string }) =>
      approveFn({ data: vars }),
    onSuccess: () => {
      toast.success("Result published");
      qc.invalidateQueries({ queryKey: ["admin", "today-observations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: (vars: { marketId: string; sessionDate: string; session: "OPEN" | "CLOSE" | "JODI" }) =>
      rejectFn({ data: vars }),
    onSuccess: () => {
      toast.success("Observations rejected");
      qc.invalidateQueries({ queryKey: ["admin", "today-observations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = q.data?.groups ?? [];
  const conflicts = groups.filter((g) => g.conflict).length;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Scraper Observations</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Today {q.data?.today ?? "—"} (IST) · {groups.length} pending · {conflicts} conflict
              {conflicts === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {q.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {q.error && (
        <p className="mt-6 text-sm text-destructive">
          Failed to load: {(q.error as Error).message}
        </p>
      )}
      {!q.isLoading && groups.length === 0 && (
        <div className="mt-8 rounded-2xl glass-gold p-8 text-center text-muted-foreground">
          No pending observations. Either everything is already declared or the scraper has not
          fetched anything yet today.
        </div>
      )}

      <div className="mt-6 grid gap-3">
        {groups.map((g) => (
          <GroupCard
            key={g.key}
            group={g}
            onApprove={(value) =>
              approveMut.mutate({
                marketId: g.market_id,
                sessionDate: g.session_date,
                session: g.session,
                value,
              })
            }
            onReject={() =>
              rejectMut.mutate({
                marketId: g.market_id,
                sessionDate: g.session_date,
                session: g.session,
              })
            }
            busy={approveMut.isPending || rejectMut.isPending}
          />
        ))}
      </div>
    </div>
  );
}

type Group = {
  key: string;
  market_id: string;
  market_name: string;
  session_date: string;
  session: "OPEN" | "CLOSE" | "JODI";
  sources: { source: string; pana: string; seen_count: number; first_seen_at: string; last_seen_at: string }[];
  conflict: boolean;
};

function GroupCard({
  group,
  onApprove,
  onReject,
  busy,
}: {
  group: Group;
  onApprove: (value: string) => void;
  onReject: () => void;
  busy: boolean;
}) {
  const distinct = [...new Set(group.sources.map((s) => s.pana))];
  const [picked, setPicked] = useState<string>(distinct[0] ?? "");

  return (
    <div className={`rounded-2xl glass-gold p-4 sm:p-5 ${group.conflict ? "ring-1 ring-amber-400/60" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-lg font-bold truncate">{group.market_name}</span>
            <span className="text-[11px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-primary/15 text-primary font-mono">
              {group.session}
            </span>
            {group.conflict && (
              <span className="text-[11px] inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-400 font-medium">
                <AlertTriangle className="h-3 w-3" /> conflict
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
            {group.market_id}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          disabled={busy}
          className="text-destructive hover:text-destructive"
        >
          <X className="h-3.5 w-3.5 mr-1.5" /> Reject all
        </Button>
      </div>

      <div className="mt-3 overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="text-xs text-muted-foreground">
            <tr className="text-left">
              <th className="px-2 py-1.5 font-medium">Pick</th>
              <th className="px-2 py-1.5 font-medium">Value</th>
              <th className="px-2 py-1.5 font-medium">Source</th>
              <th className="px-2 py-1.5 font-medium">Seen</th>
              <th className="px-2 py-1.5 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {group.sources.map((s, i) => (
              <tr key={i} className="border-t border-border/40">
                <td className="px-2 py-2">
                  <input
                    type="radio"
                    name={`pick-${group.key}`}
                    checked={picked === s.pana}
                    onChange={() => setPicked(s.pana)}
                    aria-label={`Use ${s.pana}`}
                  />
                </td>
                <td className="px-2 py-2 font-mono font-bold">{s.pana}</td>
                <td className="px-2 py-2 text-muted-foreground">{s.source}</td>
                <td className="px-2 py-2 text-muted-foreground">{s.seen_count}×</td>
                <td className="px-2 py-2 text-muted-foreground text-xs">
                  {new Date(s.last_seen_at).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button onClick={() => picked && onApprove(picked)} disabled={busy || !picked} size="sm">
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Approve & publish {picked && <span className="ml-1 font-mono">{picked}</span>}
        </Button>
      </div>
    </div>
  );
}
