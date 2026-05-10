import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Upload, FileCheck, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kyc")({
  head: () => ({ meta: [{ title: "Identity Verification — SattaKing Pro" }] }),
  component: KycPage,
});

function KycPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const submissions = useQuery({
    queryKey: ["kyc-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const latest = submissions.data?.[0];
  const approved = submissions.data?.find((s) => s.status === "APPROVED");

  const [fullName, setFullName] = useState("");
  const [pan, setPan] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const uploadFile = async (file: File, prefix: string) => {
    if (!user) throw new Error("Not signed in");
    const path = `${user.id}/${prefix}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage.from("kyc-docs").upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    if (!fullName || !pan || !dob || !docFile || !selfieFile) {
      return toast.error("Please fill all fields and attach both documents.");
    }
    setSubmitting(true);
    try {
      const [docPath, selfiePath] = await Promise.all([
        uploadFile(docFile, "doc"),
        uploadFile(selfieFile, "selfie"),
      ]);
      const masked = pan.length >= 4 ? `XXXXX${pan.slice(-4).toUpperCase()}` : pan.toUpperCase();
      const { error } = await supabase.rpc("submit_kyc", {
        _tier: 2,
        _full_name: fullName,
        _pan_masked: masked,
        _dob: dob,
        _address: address,
        _doc_urls: [docPath],
        _selfie_url: selfiePath,
      });
      if (error) throw error;
      toast.success("KYC submitted. We'll review within 24 hours.");
      setFullName(""); setPan(""); setDob(""); setAddress(""); setDocFile(null); setSelfieFile(null);
      qc.invalidateQueries({ queryKey: ["kyc-submissions"] });
    } catch (e: any) {
      toast.error(e.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold">Identity Verification</h1>
          <p className="text-sm text-muted-foreground">Required before withdrawing. Documents are encrypted and admin-only.</p>
        </div>
      </header>

      {approved && (
        <div className="glass rounded-xl p-5 border border-emerald-500/40 flex items-center gap-3">
          <FileCheck className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="font-semibold">KYC approved</p>
            <p className="text-sm text-muted-foreground">You have full account access.</p>
          </div>
        </div>
      )}

      {!approved && latest && (
        <div className={`glass rounded-xl p-5 border ${latest.status === "REJECTED" ? "border-destructive/40" : "border-amber-500/40"} flex items-start gap-3`}>
          <AlertCircle className="h-5 w-5 mt-0.5 text-amber-400" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">Latest submission:</p>
              <Badge variant="outline">{latest.status}</Badge>
            </div>
            {latest.reviewer_notes && <p className="text-sm text-muted-foreground mt-1">Notes: {latest.reviewer_notes}</p>}
          </div>
        </div>
      )}

      {!approved && (
        <section className="glass rounded-xl p-5 space-y-4">
          <h2 className="font-display text-xl">Submit Tier 2 KYC</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="fn">Full name (as on PAN)</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label htmlFor="pan">PAN number</Label>
              <Input id="pan" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} placeholder="ABCDE1234F" />
              <p className="text-xs text-muted-foreground mt-1">Stored masked. We never log full PAN.</p>
            </div>
            <div>
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="addr">Address</Label>
              <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
            </div>
            <div>
              <Label htmlFor="doc">PAN / ID document image</Label>
              <Input id="doc" type="file" accept="image/*,.pdf" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label htmlFor="selfie">Selfie holding the document</Label>
              <Input id="selfie" type="file" accept="image/*" onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <Button onClick={submit} disabled={submitting} className="gap-2">
            <Upload className="h-4 w-4" />
            {submitting ? "Submitting…" : "Submit for review"}
          </Button>
        </section>
      )}
    </div>
  );
}
