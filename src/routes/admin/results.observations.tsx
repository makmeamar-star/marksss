import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, X, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
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

type ActionStatus = "pending" | "success" | "error";
type ActionEntry = {
  id: string;
  groupKey: string;
  market_name: string;
  session: "OPEN" | "CLOSE" | "JODI";
  kind: "approve" | "reject";
  value?: string;
  status: ActionStatus;
  message?: string;
  at: number;
};

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

  const [actions, setActions] = useState<ActionEntry[]>([]);
  const upsertAction = (entry: ActionEntry) =>
    setActions((prev) => {
      const next = prev.filter((a) => a.id !== entry.id);
      return [entry, ...next].slice(0, 20);
    });
  const updateAction = (id: string, patch: Partial<ActionEntry>) =>
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const runApprove = (g: Group, value: string) => {
    const id = `approve-${g.key}-${Date.now()}`;
    upsertAction({
      id,
      groupKey: g.key,
      market_name: g.market_name,
      session: g.session,
      kind: "approve",
      value,
      status: "pending",
      at: Date.now(),
    });
    approveFn({ data: { marketId: g.market_id, sessionDate: g.session_date, session: g.session, value } })
      .then(() => {
        updateAction(id, { status: "success", message: `Published ${value}` });
        toast.success(`Published ${g.market_name} ${g.session}: ${value}`);
        qc.invalidateQueries({ queryKey: ["admin", "today-observations"] });
      })
      .catch((e: Error) => {
        updateAction(id, { status: "error", message: e.message });
        toast.error(e.message);
      });
  };

  const runReject = (g: Group) => {
    const id = `reject-${g.key}-${Date.now()}`;
    upsertAction({
      id,
      groupKey: g.key,
      market_name: g.market_name,
      session: g.session,
      kind: "reject",
      status: "pending",
      at: Date.now(),
    });
    rejectFn({ data: { marketId: g.market_id, sessionDate: g.session_date, session: g.session } })
      .then(() => {
        updateAction(id, { status: "success", message: "Observations rejected" });
        toast.success(`Rejected ${g.market_name} ${g.session}`);
        qc.invalidateQueries({ queryKey: ["admin", "today-observations"] });
      })
      .catch((e: Error) => {
        updateAction(id, { status: "error", message: e.message });
        toast.error(e.message);
      });
  };

  const allGroups = q.data?.groups ?? [];
  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("ALL");
  const [conflictsOnly, setConflictsOnly] = useState(false);

  const groups = allGroups.filter((g) => {
    if (sessionFilter !== "ALL" && g.session !== sessionFilter) return false;
    if (conflictsOnly && !g.conflict) return false;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      if (
        !g.market_name.toLowerCase().includes(s) &&
        !g.market_id.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });
  const latestByGroup = new Map<string, ActionEntry>();
  for (const a of actions) if (!latestByGroup.has(a.groupKey)) latestByGroup.set(a.groupKey, a);
  const anyPending = actions.some((a) => a.status === "pending");
  const conflicts = groups.filter((g) => g.conflict).length;

  const sessionCounts: Record<SessionFilter, number> = {
    ALL: allGroups.length,
    OPEN: allGroups.filter((g) => g.session === "OPEN").length,
    CLOSE: allGroups.filter((g) => g.session === "CLOSE").length,
    JODI: allGroups.filter((g) => g.session === "JODI").length,
  };

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
              Today {q.data?.today ?? "—"} (IST) · {groups.length} of {allGroups.length} shown ·{" "}
              {conflicts} conflict{conflicts === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="mt-5 rounded-2xl glass-gold p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search market by name or id…"
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", "OPEN", "CLOSE", "JODI"] as SessionFilter[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sessionFilter === s ? "default" : "outline"}
              onClick={() => setSessionFilter(s)}
            >
              {s} <span className="ml-1.5 text-xs opacity-70">{sessionCounts[s]}</span>
            </Button>
          ))}
          <Button
            size="sm"
            variant={conflictsOnly ? "default" : "outline"}
            onClick={() => setConflictsOnly((v) => !v)}
          >
            <AlertTriangle className="h-3 w-3 mr-1" /> Conflicts
          </Button>
          {(search || sessionFilter !== "ALL" || conflictsOnly) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setSessionFilter("ALL");
                setConflictsOnly(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {q.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {q.error && (
        <p className="mt-6 text-sm text-destructive">
          Failed to load: {(q.error as Error).message}
        </p>
      )}
      {!q.isLoading && groups.length === 0 && (
        <div className="mt-8 rounded-2xl glass-gold p-8 text-center text-muted-foreground">
          {allGroups.length === 0
            ? "No pending observations. Either everything is already declared or the scraper has not fetched anything yet today."
            : "No observations match the current filters."}
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
