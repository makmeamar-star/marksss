import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Save, ShieldAlert, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { adminDeclareResult } from "@/lib/adminDeclare.functions";
import { adminOverrideResult, adminOverrideResultJodi } from "@/lib/adminOverride.functions";

export const Route = createFileRoute("/admin/results/manual")({
  head: () => ({ meta: [{ title: "Manual Results — Admin" }] }),
  component: ManualResultsPage,
});

type MarketRow = {
  id: string; display_name: string; is_jodi_only: boolean; status: string;
};

type ResultRow = {
  market_id: string;
  session_date: string;
  open_pana: string | null;
  open_digit: number | null;
  close_pana: string | null;
  close_digit: number | null;
  jodi: string | null;
  status: string;
  declared_at: string | null;
};

function todayIST(): string {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10);
}

function ManualResultsPage() {
  const qc = useQueryClient();
  const declareFn = useServerFn(adminDeclareResult);
  const overrideFn = useServerFn(adminOverrideResult);
  const overrideJodiFn = useServerFn(adminOverrideResultJodi);

  const [date, setDate] = useState<string>(todayIST());
  const [marketId, setMarketId] = useState<string>("");
  const [session, setSession] = useState<"OPEN" | "CLOSE" | "JODI">("OPEN");
  const [value, setValue] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const marketsQ = useQuery({
    queryKey: ["admin-manual-markets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("markets")
        .select("id, display_name, is_jodi_only, status")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as MarketRow[];
    },
  });

  const market = useMemo(
    () => marketsQ.data?.find((m) => m.id === marketId) ?? null,
    [marketsQ.data, marketId],
  );

  // Force JODI when market is jodi-only
  const effectiveSession = market?.is_jodi_only ? "JODI" : session;

  const resultQ = useQuery({
    queryKey: ["admin-manual-result", marketId, date],
    queryFn: async () => {
      if (!marketId) return null;
      const { data, error } = await supabase
        .from("market_results")
        .select("*")
        .eq("market_id", marketId)
        .eq("session_date", date)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ResultRow | null;
    },
    enabled: !!marketId,
  });

  const obsQ = useQuery({
    queryKey: ["admin-manual-obs", marketId, date],
    queryFn: async () => {
      if (!marketId) return [];
      const { data, error } = await supabase
        .from("result_observations")
        .select("source, session, pana, seen_count, last_seen_at")
        .eq("market_id", marketId)
        .eq("session_date", date)
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!marketId,
    refetchInterval: 15_000,
  });

  const existing = resultQ.data;
  const existingValueForSession =
    effectiveSession === "JODI" ? existing?.jodi ?? null :
    effectiveSession === "OPEN" ? existing?.open_pana ?? null :
    existing?.close_pana ?? null;

  const expectedLen = effectiveSession === "JODI" ? 2 : 3;
  const valueValid = new RegExp(`^\\d{${expectedLen}}$`).test(value);

  async function invalidateAfter() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-manual-result"] }),
      qc.invalidateQueries({ queryKey: ["admin-manual-obs"] }),
      qc.invalidateQueries({ queryKey: ["admin", "overview"] }),
      qc.invalidateQueries({ queryKey: ["admin", "missing-results"] }),
      qc.invalidateQueries({ queryKey: ["results"] }),
      qc.invalidateQueries({ queryKey: ["result-history"] }),
    ]);
  }

  async function handleDeclare() {
    if (!marketId || !valueValid) return;
    setBusy(true);
    try {
      await declareFn({
        data: { marketId, sessionDate: date, session: effectiveSession, value },
      });
      toast.success(`Declared ${market?.display_name} ${effectiveSession} = ${value}`);
      setValue("");
      await invalidateAfter();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to declare result");
    } finally {
      setBusy(false);
    }
  }

  async function handleOverride() {
    if (!marketId || !valueValid) return;
    if (reason.trim().length < 20) {
      toast.error("Reason must be at least 20 characters");
      return;
    }
    setBusy(true);
    try {
      if (effectiveSession === "JODI") {
        await overrideJodiFn({
          data: {
            marketId, sessionDate: date, newJodi: value,
            reason, confirm: "I_UNDERSTAND_THIS_RESETTLES",
          },
        });
      } else {
        await overrideFn({
          data: {
            marketId, sessionDate: date, session: effectiveSession, newPana: value,
            reason, confirm: "I_UNDERSTAND_THIS_RESETTLES",
          },
        });
      }
      toast.success(`Override applied — bets re-settled`);
      setValue(""); setReason(""); setOverrideOpen(false);
      await invalidateAfter();
    } catch (e: any) {
      toast.error(e?.message ?? "Override failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 lg:px-6 py-6 max-w-6xl">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-gold text-background">
              <Trophy className="h-5 w-5" />
            </span>
            Manual Results
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Declare a missing result or override an auto-declared result. All actions are audited.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/results/history">History</Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl glass-gold p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Market</label>
                <Select value={marketId} onValueChange={(v) => { setMarketId(v); setValue(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
                  <SelectContent>
                    {(marketsQ.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.display_name}{m.is_jodi_only ? " (JODI)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            {!market?.is_jodi_only && (
              <div>
                <label className="text-xs text-muted-foreground">Session</label>
                <Select value={session} onValueChange={(v) => { setSession(v as any); setValue(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">OPEN (3-digit pana)</SelectItem>
                    <SelectItem value="CLOSE">CLOSE (3-digit pana)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">
                {effectiveSession === "JODI" ? "Jodi (2 digits)" : "Pana (3 digits)"}
              </label>
              <Input
                inputMode="numeric"
                maxLength={expectedLen}
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, expectedLen))}
                placeholder={"0".repeat(expectedLen)}
                className="font-mono text-lg tracking-widest"
              />
              {value && !valueValid && (
                <p className="text-xs text-destructive mt-1">Need exactly {expectedLen} digits.</p>
              )}
            </div>

            <div className="rounded-md border border-border/60 p-3 text-sm">
              <div className="text-xs text-muted-foreground">Currently declared for this session</div>
              <div className="font-mono mt-0.5">
                {existingValueForSession ?? <span className="text-muted-foreground">— not declared —</span>}
              </div>
              {existing?.declared_at && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  declared {new Date(existing.declared_at).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {!existingValueForSession ? (
                <Button
                  size="lg"
                  className="bg-gradient-gold text-background hover:brightness-110"
                  disabled={!marketId || !valueValid || busy}
                  onClick={handleDeclare}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Declare result
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="destructive"
                  disabled={!marketId || !valueValid || busy}
                  onClick={() => setOverrideOpen(true)}
                >
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Override declared result
                </Button>
              )}
            </div>

            {existingValueForSession && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/40 text-amber-500 text-xs p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Overriding reverses all settled bets for this session and re-settles using the new value.
                  Requires a reason of at least 20 characters.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl glass-gold p-5">
            <h2 className="font-display text-lg font-bold mb-2">Today's full result</h2>
            <div className="text-sm space-y-1">
              <div>Open: <span className="font-mono">{existing?.open_pana ?? "—"}{existing?.open_digit != null ? `-${existing.open_digit}` : ""}</span></div>
              <div>Jodi: <span className="font-mono">{existing?.jodi ?? "—"}</span></div>
              <div>Close: <span className="font-mono">{existing?.close_digit != null ? `${existing.close_digit}-` : ""}{existing?.close_pana ?? "—"}</span></div>
              <div className="text-xs text-muted-foreground pt-1">Status: {existing?.status ?? "PENDING"}</div>
            </div>
          </div>

          <div className="rounded-2xl glass-gold p-5">
            <h2 className="font-display text-lg font-bold mb-2">Scraper observations</h2>
            {(obsQ.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No observations recorded today.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1">Session</th>
                    <th>Value</th>
                    <th>Source</th>
                    <th>Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {(obsQ.data ?? []).map((o: any, i: number) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="py-1">{o.session}</td>
                      <td className="font-mono">{o.pana}</td>
                      <td>{o.source}</td>
                      <td>{o.seen_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <Dialog open={overrideOpen} onOpenChange={(v) => !busy && setOverrideOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override declared result</DialogTitle>
            <DialogDescription>
              Replace <span className="font-mono">{existingValueForSession}</span> with{" "}
              <span className="font-mono">{value}</span> for {market?.display_name} {effectiveSession}.
              All settled bets for this session will be reversed and re-settled.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (min 20 chars, visible in audit log)"
            rows={4}
          />
          <div className="text-xs text-muted-foreground">{reason.length} / 20+ characters</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOverrideOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleOverride}
              disabled={busy || reason.trim().length < 20 || !valueValid}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
              Override + re-settle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
