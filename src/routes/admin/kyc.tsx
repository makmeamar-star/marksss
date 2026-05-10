import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, FileSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/kyc")({
  head: () => ({ meta: [{ title: "KYC Review — Admin" }] }),
  component: AdminKycPage,
});

type Status = "PENDING" | "MORE_INFO" | "APPROVED" | "REJECTED";

function AdminKycPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("PENDING");
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [notes, setNotes] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const ch = supabase
      .channel("admin-kyc")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" }, (p) => {
        qc.invalidateQueries({ queryKey: ["admin-kyc"] });
        if (p.eventType === "INSERT") toast.info("New KYC submission");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-kyc", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const openReview = async (row: any) => {
    setReviewing(row);
    setNotes(row.reviewer_notes ?? "");
    const paths = [...(row.doc_urls ?? []), row.selfie_url].filter(Boolean) as string[];
    const map: Record<string, string> = {};
    await Promise.all(paths.map(async (p) => {
      const { data } = await supabase.storage.from("kyc-docs").createSignedUrl(p, 600);
      if (data?.signedUrl) map[p] = data.signedUrl;
    }));
    setSignedUrls(map);
  };

  const decide = async (decision: "APPROVED" | "REJECTED" | "MORE_INFO") => {
    if (!reviewing) return;
    const { error } = await supabase.rpc("review_kyc", {
      _kyc_id: reviewing.id,
      _decision: decision,
      _notes: notes || undefined,
    });
    if (error) return toast.error(error.message);
    toast.success(`Marked ${decision}`);
    setReviewing(null);
    qc.invalidateQueries({ queryKey: ["admin-kyc"] });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-4">
      <header>
        <h1 className="font-display text-3xl font-bold">KYC Review Queue</h1>
        <p className="text-sm text-muted-foreground">Verify identity submissions before approving withdrawals.</p>
      </header>

      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="MORE_INFO">More info</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !data?.length ? (
        <div className="glass rounded-xl p-10 text-center text-muted-foreground">No submissions in this state.</div>
      ) : (
        <div className="grid gap-3">
          {data.map((row) => (
            <div key={row.id} className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{row.full_name ?? "—"}</p>
                  <Badge variant="outline">Tier {row.tier}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">PAN {row.pan_masked} · DOB {row.dob ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Submitted {new Date(row.created_at).toLocaleString()}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => openReview(row)}>
                <FileSearch className="h-4 w-4" /> Review
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review KYC — {reviewing?.full_name}</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">PAN:</span> {reviewing.pan_masked}</div>
                <div><span className="text-muted-foreground">DOB:</span> {reviewing.dob}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {reviewing.address}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(signedUrls).map(([path, url]) => (
                  <a key={path} href={url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-border">
                    {/\.(png|jpg|jpeg|webp)$/i.test(path)
                      ? <img src={url} alt={path} className="w-full h-48 object-contain bg-black/40" />
                      : <div className="p-6 text-center text-sm">Open document ↗</div>}
                  </a>
                ))}
              </div>
              <Textarea placeholder="Notes (visible to user)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => decide("MORE_INFO")}>Need more info</Button>
            <Button variant="destructive" onClick={() => decide("REJECTED")} className="gap-1"><X className="h-4 w-4" />Reject</Button>
            <Button onClick={() => decide("APPROVED")} className="gap-1"><Check className="h-4 w-4" />Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
