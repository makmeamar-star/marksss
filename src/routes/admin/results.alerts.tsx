import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, ShieldCheck, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listScraperAlerts,
  manualPublishResult,
  dismissScraperAlert,
} from "@/lib/scraperAlerts.functions";

export const Route = createFileRoute("/admin/results/alerts")({
  head: () => ({
    meta: [
      { title: "Scraper Alerts — Admin" },
      { name: "description", content: "Review scraper mismatches and manually publish results." },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const fetchAlerts = useServerFn(listScraperAlerts);
  const q = useQuery({
    queryKey: ["admin", "scraper-alerts"],
    queryFn: () => fetchAlerts(),
    refetchInterval: 30_000,
  });

  const data = q.data;

  return (
    <div className="container mx-auto px-4 lg:px-6 py-6 max-w-6xl">
      <nav className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
        <Link to="/admin" className="hover:text-foreground">Admin</Link>
        <ChevronRight className="h-3 w-3" />
        <span>Results</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-primary">Alerts</span>
      </nav>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-500/20 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </span>
            Scraper Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review mismatches and manually publish the correct value.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.error && (
        <p className="text-sm text-destructive">Failed to load: {(q.error as Error).message}</p>
      )}

      {/* Triage groups: any market+date+session with observations and no result */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Pending triage ({data?.groups.length ?? 0})</h2>
        {data && data.groups.length === 0 && (
          <div className="rounded-xl glass-gold p-6 text-sm text-muted-foreground text-center">
            <ShieldCheck className="h-5 w-5 mx-auto mb-2 text-emerald-400" />
            No undeclared markets with scraper observations. Everything is clean.
          </div>
        )}
        {(data?.groups ?? []).map((g) => (
          <GroupCard key={g.key} group={g} onChanged={() => q.refetch()} />
        ))}
      </section>

      {/* Raw alerts list (audit) */}
      <section className="mt-10 space-y-2">
        <h2 className="font-display text-lg font-bold">Recent alerts ({data?.alerts.length ?? 0})</h2>
        <div className="rounded-xl glass-gold divide-y divide-border/40">
          {(data?.alerts ?? []).map((a: any) => (
            <AlertRow key={a.id} alert={a} onResolved={() => q.refetch()} />
          ))}
          {data && data.alerts.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">No unresolved alerts.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function GroupCard({
  group,
  onChanged,
}: {
  group: {
    key: string;
    market_id: string;
    session_date: string;
    session: string;
    sources: { source: string; pana: string; seen_count: number; last_seen_at: string }[];
    conflict: boolean;
  };
  onChanged: () => void;
}) {
  const publish = useServerFn(manualPublishResult);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  const expectedLen = group.session === "JODI" ? 2 : 3;
  const distinct = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of group.sources) m.set(s.pana, (m.get(s.pana) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [group.sources]);

  async function doPublish(value: string) {
    if (!new RegExp(`^\\d{${expectedLen}}$`).test(value)) {
      toast.error(`Value must be ${expectedLen} digits`);
      return;
    }
    setBusy(true);
    try {
      await publish({
        data: {
          marketId: group.market_id,
          sessionDate: group.session_date,
          session: group.session as "OPEN" | "CLOSE" | "JODI",
          value,
        },
      });
      toast.success(`Published ${group.market_id} ${group.session} = ${value}`);
      qc.invalidateQueries();
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to publish");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl glass-gold p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold">{group.market_id}</span>
            <Badge variant="outline" className="text-[10px]">{group.session}</Badge>
            <Badge variant="outline" className="text-[10px]">{group.session_date}</Badge>
            {group.conflict && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px]">
                CONFLICT
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-2">Reported by sources</p>
          <ul className="space-y-1.5">
            {distinct.map(([pana, count]) => {
              const sources = group.sources.filter((s) => s.pana === pana).map((s) => s.source);
              return (
                <li
                  key={pana}
                  className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-lg">{pana}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {sources.join(", ")} ({count})
                    </span>
                  </div>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => doPublish(pana)}
                    className="bg-gradient-gold text-background"
                  >
                    Publish
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Or enter the correct {expectedLen}-digit value manually
          </p>
          <div className="flex gap-2">
            <Input
              value={custom}
              maxLength={expectedLen}
              inputMode="numeric"
              placeholder={"0".repeat(expectedLen)}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
              className="font-mono"
            />
            <Button
              disabled={busy || custom.length !== expectedLen}
              onClick={() => doPublish(custom)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertRow({
  alert,
  onResolved,
}: {
  alert: { id: string; title: string; message: string; created_at: string; context: any };
  onResolved: () => void;
}) {
  const dismiss = useServerFn(dismissScraperAlert);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3 p-3 text-sm">
      <div className="min-w-0">
        <div className="font-medium">{alert.title}</div>
        <div className="text-xs text-muted-foreground break-words">{alert.message}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {new Date(alert.created_at).toLocaleString()}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await dismiss({ data: { alertId: alert.id } });
            toast.success("Dismissed");
            onResolved();
          } catch (e: any) {
            toast.error(e?.message ?? "Failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
