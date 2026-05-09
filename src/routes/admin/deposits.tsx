import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/deposits")({
  head: () => ({ meta: [{ title: "Deposits — Admin" }] }),
  component: AdminDepositsPage,
});

type Status = "PENDING" | "APPROVED" | "REJECTED";

function AdminDepositsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("PENDING");

  useEffect(() => {
    const ch = supabase
      .channel("admin-deposits")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_requests" }, (p) => {
        qc.invalidateQueries({ queryKey: ["admin-deposits"] });
        if (p.eventType === "INSERT") toast.info("New deposit request");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-deposits", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_requests")
        .select("*, profiles!deposit_requests_user_id_fkey(username,email)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        // Fallback if FK relationship name is missing
        const r = await supabase.from("deposit_requests").select("*").eq("status", status).order("created_at", { ascending: false }).limit(100);
        if (r.error) throw r.error;
        return r.data ?? [];
      }
      return data ?? [];
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Deposit Requests</h1>
          <p className="text-sm text-muted-foreground">Review and approve user deposits.</p>
        </div>
        <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
          <TabsList className="bg-surface border border-border/60">
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
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
                  <th className="text-left p-2">User</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="text-left p-2">Method</th>
                  <th className="text-left p-2">UTR</th>
                  <th className="text-left p-2">Screenshot</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => <Row key={r.id} req={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ req }: { req: any }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [shotUrl, setShotUrl] = useState<string | null>(null);

  const profile = req.profiles ?? null;
  const userLabel = profile ? `${profile.username} · ${profile.email}` : req.user_id.slice(0, 8);

  const viewScreenshot = async () => {
    if (!req.screenshot_url) return;
    const { data } = await supabase.storage.from("payment-screenshots").createSignedUrl(req.screenshot_url, 60);
    if (data?.signedUrl) setShotUrl(data.signedUrl);
  };

  const approve = async () => {
    setBusy("approve");
    const { error } = await supabase.rpc("approve_deposit", { _request_id: req.id, _note: null });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Deposit approved");
    qc.invalidateQueries({ queryKey: ["admin-deposits"] });
  };

  const submitReject = async () => {
    if (reason.trim().length < 3) return toast.error("Reason required");
    setBusy("reject");
    const { error } = await supabase.rpc("reject_deposit", { _request_id: req.id, _reason: reason });
    setBusy(null); setRejectOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Deposit rejected");
    setReason("");
    qc.invalidateQueries({ queryKey: ["admin-deposits"] });
  };

  return (
    <>
      <tr className="border-t border-border/40">
        <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(req.created_at).toLocaleString()}</td>
        <td className="p-2 text-xs">{userLabel}</td>
        <td className="p-2 text-right font-mono">₹{Number(req.amount).toLocaleString("en-IN")}</td>
        <td className="p-2"><span className="px-2 py-0.5 rounded border border-border/60 text-xs">{req.method}</span></td>
        <td className="p-2 font-mono text-xs">{req.utr ?? "—"}</td>
        <td className="p-2">
          {req.screenshot_url ? (
            <Button size="sm" variant="ghost" onClick={viewScreenshot}><ImageIcon className="h-4 w-4 mr-1" /> View</Button>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="p-2 text-right whitespace-nowrap">
          {req.status === "PENDING" ? (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30" disabled={!!busy} onClick={approve}>
                {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />} Approve
              </Button>
              <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" disabled={!!busy} onClick={() => setRejectOpen(true)}>
                <X className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
            </div>
          ) : (
            <span className={`text-xs uppercase font-semibold ${req.status === "APPROVED" ? "text-emerald-400" : "text-destructive"}`}>{req.status}</span>
          )}
        </td>
      </tr>

      <Dialog open={!!shotUrl} onOpenChange={(o) => !o && setShotUrl(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payment screenshot</DialogTitle></DialogHeader>
          {shotUrl && <img src={shotUrl} alt="screenshot" className="max-h-[70vh] w-full object-contain rounded" />}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject deposit ₹{Number(req.amount).toLocaleString("en-IN")}</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (visible to user)" rows={3} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button className="bg-destructive text-destructive-foreground" disabled={busy === "reject"} onClick={submitReject}>
              {busy === "reject" && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
