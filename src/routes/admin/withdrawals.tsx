import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, X, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Withdrawals — Admin" }] }),
  component: AdminWithdrawalsPage,
});

type Status = "PENDING" | "APPROVED" | "PAID" | "DECLINED";

function AdminWithdrawalsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("PENDING");

  useEffect(() => {
    const ch = supabase
      .channel("admin-withdrawals")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, (p) => {
        qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
        if (p.eventType === "INSERT") toast.info("New withdrawal request");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals", status],
    queryFn: async () => {
      // DECLINED tab also shows legacy REJECTED rows
      const statuses = status === "DECLINED" ? ["DECLINED", "REJECTED"] : [status];
      const r = await supabase.from("withdrawal_requests").select("*").in("status", statuses).order("created_at", { ascending: false }).limit(100);
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Withdrawal Requests</h1>
          <p className="text-sm text-muted-foreground">Approve, decline, and mark paid.</p>
        </div>
        <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
          <TabsList className="bg-surface border border-border/60">
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="PAID">Paid</TabsTrigger>
            <TabsTrigger value="DECLINED">Declined</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="glass rounded-xl p-4">
        {isLoading && <div className="py-10 text-center"><Loader2 className="h-5 w-5 inline animate-spin" /></div>}
        {data && data.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No {status.toLowerCase()} requests.</p>}
        {data && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-2">When</th>
                  <th className="text-left p-2">SLA</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="text-left p-2">Method</th>
                  <th className="text-left p-2">Destination</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>{data.map((r) => <Row key={r.id} req={r} />)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ req }: { req: any }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"approve" | "decline" | "paid" | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [paidNote, setPaidNote] = useState("");

  const dest = req.bank_details?.upi
    ? `UPI · ${req.bank_details.upi}`
    : req.bank_details?.raw ?? JSON.stringify(req.bank_details ?? {}).slice(0, 60);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });

  const approve = async () => {
    setBusy("approve");
    const { error } = await supabase.rpc("approve_withdrawal", { _request_id: req.id, _note: undefined });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal approved");
    invalidate();
  };

  const submitDecline = async () => {
    if (reason.trim().length < 3) return toast.error("Reason required");
    setBusy("decline");
    const { error } = await supabase.rpc("decline_withdrawal", { _request_id: req.id, _reason: reason });
    setBusy(null); setDeclineOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal declined");
    setReason("");
    invalidate();
  };

  const submitPaid = async () => {
    setBusy("paid");
    const { error } = await supabase.rpc("mark_withdrawal_paid", { _request_id: req.id, _note: paidNote || undefined });
    setBusy(null); setPaidOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid");
    setPaidNote("");
    invalidate();
  };

  const statusClass =
    req.status === "PAID" ? "text-emerald-300"
    : req.status === "APPROVED" ? "text-emerald-400"
    : req.status === "DECLINED" || req.status === "REJECTED" ? "text-destructive"
    : "text-amber-400";

  return (
    <>
      <tr className="border-t border-border/40">
        <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(req.created_at).toLocaleString()}</td>
        <td className="p-2"><SlaBadge dueAt={req.sla_due_at} status={req.status} /></td>
        <td className="p-2 text-xs font-mono">{req.user_id.slice(0, 8)}…</td>
        <td className="p-2 text-right font-mono">₹{Number(req.amount).toLocaleString("en-IN")}</td>
        <td className="p-2"><span className="px-2 py-0.5 rounded border border-border/60 text-xs">{req.method}</span></td>
        <td className="p-2 text-xs max-w-xs truncate" title={dest}>{dest}</td>
        <td className="p-2 text-right whitespace-nowrap">
          {req.status === "PENDING" && (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30" disabled={!!busy} onClick={approve}>
                {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />} Approve
              </Button>
              <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" disabled={!!busy} onClick={() => setDeclineOpen(true)}>
                <X className="h-3.5 w-3.5 mr-1" /> Decline
              </Button>
            </div>
          )}
          {req.status === "APPROVED" && (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" className="bg-emerald-500/30 text-emerald-200 hover:bg-emerald-500/40 border border-emerald-500/50" disabled={!!busy} onClick={() => setPaidOpen(true)}>
                <BadgeCheck className="h-3.5 w-3.5 mr-1" /> Mark paid
              </Button>
            </div>
          )}
          {(req.status === "PAID" || req.status === "DECLINED" || req.status === "REJECTED") && (
            <span className={`text-xs uppercase font-semibold ${statusClass}`}>{req.status}</span>
          )}
        </td>
      </tr>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decline withdrawal ₹{Number(req.amount).toLocaleString("en-IN")}</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (visible to user)" rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button className="bg-destructive text-destructive-foreground" disabled={busy === "decline"} onClick={submitDecline}>
              {busy === "decline" && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark paid · ₹{Number(req.amount).toLocaleString("en-IN")}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Confirm the payout was sent to the user. Optionally add a UTR/reference.</p>
          <Input value={paidNote} onChange={(e) => setPaidNote(e.target.value)} placeholder="UTR / reference (optional)" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaidOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-500/30 text-emerald-100 hover:bg-emerald-500/40 border border-emerald-500/60" disabled={busy === "paid"} onClick={submitPaid}>
              {busy === "paid" && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Mark paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SlaBadge({ dueAt, status }: { dueAt: string | null; status: string }) {
  if (!dueAt) return <span className="text-xs text-muted-foreground">—</span>;
  if (status !== "PENDING") return <span className="text-xs text-muted-foreground">done</span>;
  const ms = new Date(dueAt).getTime() - Date.now();
  const mins = Math.round(ms / 60000);
  const breach = ms < 0;
  const warn = ms >= 0 && ms < 30 * 60000;
  const cls = breach
    ? "bg-destructive/20 text-destructive border-destructive/40"
    : warn
      ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  const label = breach
    ? `breached ${Math.abs(mins)}m`
    : mins < 60
      ? `${mins}m left`
      : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return <span className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider whitespace-nowrap ${cls}`}>{label}</span>;
}
