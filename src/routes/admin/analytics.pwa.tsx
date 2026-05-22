import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Smartphone, Apple, Globe, Download, MousePointerClick, Eye, Check, X, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPwaInstallFunnel, type PwaFunnelRow } from "@/lib/pwaAnalytics.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/analytics/pwa")({
  head: () => ({ meta: [{ title: "PWA Install Funnel — Admin" }] }),
  component: PwaFunnelPage,
});

const RANGES = [7, 14, 30, 90] as const;

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

const PLATFORM_META: Record<string, { label: string; icon: typeof Smartphone }> = {
  android: { label: "Android", icon: Smartphone },
  ios: { label: "iOS", icon: Apple },
  other: { label: "Other", icon: Globe },
};

function PwaFunnelPage() {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const fetchFunnel = useServerFn(getPwaInstallFunnel);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "pwa-funnel", rangeDays],
    queryFn: () => fetchFunnel({ data: { rangeDays } }),
  });

  // Live updates via Supabase Realtime: debounce-refetch on new events.
  const queryClient = useQueryClient();
  const [liveCount, setLiveCount] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const channel = supabase
      .channel("pwa_install_events:admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pwa_install_events" },
        () => {
          setLiveCount((n) => n + 1);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "pwa-funnel"] });
          }, 1500);
        },
      )
      .subscribe((status) => setIsLive(status === "SUBSCRIBED"));
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">PWA Install Funnel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shown → Clicked → Accepted, by platform. Helps tune the install prompt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${
              isLive
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border/60 bg-muted/40 text-muted-foreground"
            }`}
            title={isLive ? "Receiving live events" : "Live channel not connected"}
          >
            <Radio className={`h-3 w-3 ${isLive ? "animate-pulse" : ""}`} />
            {isLive ? "Live" : "Offline"}
            {liveCount > 0 && <span className="font-medium">· {liveCount}</span>}
          </span>
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={rangeDays === r ? "default" : "outline"}
              onClick={() => setRangeDays(r)}
            >
              {r}d
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && (
        <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive">
          Failed to load funnel data.
        </Card>
      )}

      {data && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard icon={Eye} label="Prompt shown" value={fmt(data.totals.shown)} />
            <StatCard icon={MousePointerClick} label="Clicked install" value={fmt(data.totals.clicked)} sub={pct(data.totals.clickRate)} />
            <StatCard icon={Check} label="Accepted" value={fmt(data.totals.accepted)} sub={pct(data.totals.acceptRate)} />
            <StatCard icon={X} label="Dismissed" value={fmt(data.totals.dismissed)} />
            <StatCard icon={Download} label="Installed" value={fmt(data.totals.installed)} sub={pct(data.totals.installRate)} highlight />
          </div>

          {/* Per-platform funnel */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60">
              <h2 className="font-semibold">By platform</h2>
              <p className="text-xs text-muted-foreground">
                Bars show conversion at each step relative to the prior step. {fmt(data.totalEvents)} events in window.
              </p>
            </div>
            <div className="divide-y divide-border/60">
              {data.byPlatform.map((row) => (
                <PlatformFunnel key={row.platform} row={row} />
              ))}
            </div>
          </Card>

          {/* Daily trend */}
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Daily: prompts shown vs installs</h2>
            <DailyChart points={data.daily} />
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: typeof Smartphone;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-4 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold">{value}</span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
    </Card>
  );
}

function PlatformFunnel({ row }: { row: PwaFunnelRow }) {
  const meta = PLATFORM_META[row.platform] ?? PLATFORM_META.other;
  const Icon = meta.icon;
  const steps = [
    { label: "Shown", value: row.shown, max: row.shown, color: "bg-muted-foreground/30" },
    { label: "Clicked", value: row.clicked, max: row.shown, color: "bg-primary/40" },
    { label: "Accepted", value: row.accepted, max: row.shown, color: "bg-emerald-500/60" },
    { label: "Installed", value: row.installed, max: row.shown, color: "bg-emerald-500" },
  ];
  const denom = row.shown || 1;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-semibold">{meta.label}</span>
          <span className="text-xs text-muted-foreground">· {fmt(row.shown)} prompts</span>
        </div>
        <div className="text-xs text-muted-foreground">
          CTR <span className="text-foreground font-medium">{pct(row.clickRate)}</span>{" · "}
          Accept <span className="text-foreground font-medium">{pct(row.acceptRate)}</span>{" · "}
          Install <span className="text-foreground font-medium">{pct(row.installRate)}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {steps.map((s) => {
          const w = Math.max(0, Math.min(100, (s.value / denom) * 100));
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-20 text-xs text-muted-foreground">{s.label}</span>
              <div className="flex-1 h-5 rounded bg-muted/40 overflow-hidden">
                <div className={`h-full ${s.color} transition-all`} style={{ width: `${w}%` }} />
              </div>
              <span className="w-20 text-right text-xs tabular-nums">{fmt(s.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyChart({ points }: { points: { date: string; shown: number; installed: number }[] }) {
  if (!points.length) {
    return <p className="text-sm text-muted-foreground">No events in this window yet.</p>;
  }
  const max = Math.max(1, ...points.map((p) => Math.max(p.shown, p.installed)));
  return (
    <div className="flex items-end gap-1 h-40">
      {points.map((p) => (
        <div key={p.date} className="flex-1 flex flex-col items-center gap-0.5 group min-w-0">
          <div className="w-full flex items-end gap-0.5 h-32">
            <div
              className="flex-1 bg-muted-foreground/40 rounded-t"
              style={{ height: `${(p.shown / max) * 100}%` }}
              title={`${p.date} · ${p.shown} shown`}
            />
            <div
              className="flex-1 bg-primary rounded-t"
              style={{ height: `${(p.installed / max) * 100}%` }}
              title={`${p.date} · ${p.installed} installed`}
            />
          </div>
          <span className="text-[9px] text-muted-foreground rotate-45 origin-left whitespace-nowrap mt-1">
            {p.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}
