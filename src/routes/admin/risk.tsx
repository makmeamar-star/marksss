import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ShieldAlert, AlertTriangle, Activity, Users, Flame } from "lucide-react";

export const Route = createFileRoute("/admin/risk")({
  head: () => ({ meta: [{ title: "Risk & Ops — Admin" }] }),
  component: RiskPage,
});

const fmt = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

function RiskPage() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-display">Risk & Ops Center</h1>
          <p className="text-sm text-muted-foreground">Live exposure, fraud signals, bulk user actions.</p>
        </div>
      </header>

      <RiskSummary />

      <Tabs defaultValue="heatmap">
        <TabsList>
          <TabsTrigger value="heatmap"><Flame className="h-4 w-4 mr-1" />Exposure Heatmap</TabsTrigger>
          <TabsTrigger value="fraud"><AlertTriangle className="h-4 w-4 mr-1" />Fraud Signals</TabsTrigger>
          <TabsTrigger value="bulk"><Users className="h-4 w-4 mr-1" />Bulk Actions</TabsTrigger>
        </TabsList>
        <TabsContent value="heatmap"><ExposureHeatmap /></TabsContent>
        <TabsContent value="fraud"><FraudSignals /></TabsContent>
        <TabsContent value="bulk"><BulkActions /></TabsContent>
      </Tabs>
    </div>
  );
}

function RiskSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-risk-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_risk_summary" as never);
      if (error) throw error;
      return data as Record<string, number>;
    },
    refetchInterval: 30_000,
  });

  const cards = [
    { label: "Handle Today", value: fmt(data?.handle_today ?? 0), icon: Activity, color: "text-primary" },
    { label: "Open Exposure", value: fmt(data?.open_exposure ?? 0), icon: Flame, color: "text-destructive" },
    { label: "House P&L Today", value: fmt(data?.house_pnl_today ?? 0), icon: ShieldAlert, color: (data?.house_pnl_today ?? 0) >= 0 ? "text-emerald-500" : "text-destructive" },
    { label: "Pending Bets", value: data?.pending_bets ?? 0, icon: Activity, color: "text-amber-500" },
    { label: "Pending Withdrawals", value: data?.pending_withdrawals ?? 0, icon: Users, color: "text-amber-500" },
    { label: "Breached SLA", value: data?.breached_sla ?? 0, icon: AlertTriangle, color: "text-destructive" },
    { label: "Pending Deposits", value: data?.pending_deposits ?? 0, icon: Activity, color: "text-amber-500" },
    { label: "Pending KYC", value: data?.pending_kyc ?? 0, icon: Users, color: "text-amber-500" },
    { label: "Active Today", value: data?.active_users_today ?? 0, icon: Users, color: "text-primary" },
    { label: "Suspended Users", value: data?.suspended_users ?? 0, icon: ShieldAlert, color: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</span>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className={`text-xl font-bold ${c.color}`}>{isLoading ? "…" : c.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ExposureHeatmap() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-exposure-heatmap"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_exposure_heatmap" as never);
      if (error) throw error;
      return (data ?? []) as Array<{ market_id: string; bet_type: string; bet_number: string; total_stake: number; total_liability: number; bet_count: number }>;
    },
    refetchInterval: 30_000,
  });

  const max = Math.max(1, ...(data ?? []).map((r) => Number(r.total_liability)));

  return (
    <Card>
      <CardHeader><CardTitle>Open Exposure by Market & Number</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead className="text-right">Bets</TableHead>
                  <TableHead className="text-right">Stake</TableHead>
                  <TableHead className="text-right">Liability</TableHead>
                  <TableHead>Heat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((r, i) => {
                  const pct = (Number(r.total_liability) / max) * 100;
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.market_id}</TableCell>
                      <TableCell><Badge variant="outline">{r.bet_type}</Badge></TableCell>
                      <TableCell className="font-mono">{r.bet_number}</TableCell>
                      <TableCell className="text-right">{r.bet_count}</TableCell>
                      <TableCell className="text-right">{fmt(r.total_stake)}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{fmt(r.total_liability)}</TableCell>
                      <TableCell className="w-32">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-destructive" style={{ width: `${pct}%` }} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!data || data.length === 0) && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No open exposure.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FraudSignals() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-fraud-signals"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_fraud_signals" as never);
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; username: string; signal: string; severity: string; detail: Record<string, unknown> }>;
    },
    refetchInterval: 60_000,
  });

  const sevColor = (s: string) => s === "high" ? "destructive" : s === "medium" ? "default" : "secondary";

  return (
    <Card>
      <CardHeader><CardTitle>Fraud Signal Feed</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.username}</TableCell>
                  <TableCell><Badge variant="outline">{r.signal}</Badge></TableCell>
                  <TableCell><Badge variant={sevColor(r.severity) as never}>{r.severity}</Badge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{JSON.stringify(r.detail)}</TableCell>
                </TableRow>
              ))}
              {(!data || data.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No signals detected.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function BulkActions() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-bulk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, email, balance, status, total_bet, total_deposit")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (users ?? []).filter((u) =>
    !filter || u.username?.toLowerCase().includes(filter.toLowerCase()) || u.email?.toLowerCase().includes(filter.toLowerCase())
  );

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };

  const mutate = useMutation({
    mutationFn: async (status: string) => {
      const { data, error } = await supabase.rpc("admin_bulk_user_status" as never, {
        _user_ids: Array.from(selected),
        _status: status,
      } as never);
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n, status) => {
      toast.success(`Updated ${n} user${n === 1 ? "" : "s"} → ${status}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-users-bulk"] });
      qc.invalidateQueries({ queryKey: ["admin-risk-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk User Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            placeholder="Search username or email…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 rounded-md bg-muted text-sm flex-1 min-w-[200px]"
          />
          <Badge variant="outline">{selected.size} selected</Badge>
          <Button size="sm" variant="destructive" disabled={!selected.size || mutate.isPending} onClick={() => mutate.mutate("SUSPENDED")}>Suspend</Button>
          <Button size="sm" variant="outline" disabled={!selected.size || mutate.isPending} onClick={() => mutate.mutate("FROZEN")}>Freeze</Button>
          <Button size="sm" disabled={!selected.size || mutate.isPending} onClick={() => mutate.mutate("ACTIVE")}>Activate</Button>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Total Bet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : filtered.map((u) => (
                <TableRow key={u.user_id} data-state={selected.has(u.user_id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox checked={selected.has(u.user_id)} onCheckedChange={() => toggle(u.user_id)} />
                  </TableCell>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.status === "ACTIVE" ? "default" : u.status === "SUSPENDED" ? "destructive" : "secondary"}>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{fmt(Number(u.balance))}</TableCell>
                  <TableCell className="text-right">{fmt(Number(u.total_bet))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
