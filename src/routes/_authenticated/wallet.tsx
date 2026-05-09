import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpToLine, Wallet, History, Loader2, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — SattaKing Pro" }] }),
  component: WalletPage,
});

const DEMO_UPI = "sattakingpro@upi";

function WalletPage() {
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const qc = useQueryClient();

  // Realtime: balance + new requests
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("wallet-self-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, () => refreshProfile())
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, () =>
        qc.invalidateQueries({ queryKey: ["wallet-tx", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_requests", filter: `user_id=eq.${user.id}` }, () =>
        qc.invalidateQueries({ queryKey: ["wallet-deposits", user.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests", filter: `user_id=eq.${user.id}` }, () =>
        qc.invalidateQueries({ queryKey: ["wallet-withdrawals", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc, refreshProfile]);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Wallet</h1>
        <p className="text-sm text-muted-foreground">Deposits, withdrawals & ledger.</p>
      </header>

      <div className="grid sm:grid-cols-4 gap-3">
        <KpiCard label="Available Balance" value={`₹${user.balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} accent />
        <KpiCard label="Lifetime Deposits" value={`₹${user.totalDeposit.toLocaleString("en-IN")}`} />
        <KpiCard label="Lifetime Withdrawals" value={`₹${user.totalWithdraw.toLocaleString("en-IN")}`} />
        <KpiCard label="Total Won" value={`₹${user.totalWin.toLocaleString("en-IN")}`} positive />
      </div>

      <Tabs defaultValue="deposit">
        <TabsList className="bg-surface border border-border/60">
          <TabsTrigger value="deposit"><ArrowDownToLine className="h-4 w-4 mr-1" /> Deposit</TabsTrigger>
          <TabsTrigger value="withdraw"><ArrowUpToLine className="h-4 w-4 mr-1" /> Withdraw</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> History</TabsTrigger>
        </TabsList>
        <TabsContent value="deposit"><DepositForm userId={user.id} /></TabsContent>
        <TabsContent value="withdraw"><WithdrawForm userId={user.id} balance={user.balance} /></TabsContent>
        <TabsContent value="history"><WalletHistory userId={user.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, accent, positive }: { label: string; value: string; accent?: boolean; positive?: boolean }) {
  return (
    <div className={`${accent ? "glass-gold" : "glass"} rounded-xl p-4`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono text-2xl font-bold mt-1 ${accent ? "text-primary text-glow-gold" : positive ? "text-emerald-400" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function DepositForm({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("500");
  const [method, setMethod] = useState<"UPI" | "BANK">("UPI");
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: pending } = useQuery({
    queryKey: ["wallet-deposits", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_requests")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = async () => {
    const n = Number(amount);
    if (!n || n < 100) return toast.error("Minimum deposit is ₹100");
    if (n > 100000) return toast.error("Maximum deposit is ₹100,000");
    if (!utr || utr.length < 4) return toast.error("Enter a valid UTR / reference");
    setBusy(true);
    try {
      let screenshot_url: string | null = null;
      if (file) {
        const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
        const up = await supabase.storage.from("payment-screenshots").upload(path, file);
        if (up.error) throw new Error(up.error.message);
        screenshot_url = up.data.path;
      }
      const { error } = await supabase.from("deposit_requests").insert({
        user_id: userId, amount: n, method, utr, screenshot_url, status: "PENDING",
      });
      if (error) throw error;
      toast.success("Deposit submitted — awaiting admin approval");
      setUtr(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["wallet-deposits", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-display text-lg font-bold">Add Funds</h3>
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" min={100} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex gap-2 mt-2">
            {[500, 1000, 2500, 5000].map((v) => (
              <button key={v} type="button" className="flex-1 rounded-md border border-border/60 py-1 text-xs hover:border-primary/50" onClick={() => setAmount(String(v))}>
                ₹{v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as "UPI" | "BANK")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UPI">UPI Transfer</SelectItem>
              <SelectItem value="BANK">Bank Transfer (IMPS/NEFT)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>UTR / Reference *</Label>
          <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 4234567890" />
        </div>
        <div>
          <Label>Screenshot (optional)</Label>
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button className="w-full bg-gradient-gold text-background" onClick={submit} disabled={busy}>
          {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : "I have paid — submit"}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="glass-gold rounded-xl p-5 text-center space-y-2">
          <h3 className="font-display text-lg font-bold">Pay to</h3>
          <div className="mx-auto h-32 w-32 grid place-items-center rounded-lg bg-background/40 border border-primary/30">
            <QrCode className="h-24 w-24 text-primary/80" />
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="font-mono text-primary">{DEMO_UPI}</span>
            <button onClick={() => { navigator.clipboard.writeText(DEMO_UPI); toast.success("Copied"); }} className="text-muted-foreground hover:text-primary">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="glass rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-semibold">Recent requests</h4>
          {pending?.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
          {pending?.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border border-border/40 rounded-md px-3 py-2">
              <div>
                <div className="font-mono">₹{Number(r.amount).toLocaleString("en-IN")}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <StatusBadge status={r.status} reason={r.reject_reason ?? undefined} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WithdrawForm({ userId, balance }: { userId: string; balance: number }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("500");
  const [method, setMethod] = useState<"UPI" | "BANK">("UPI");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: history } = useQuery({
    queryKey: ["wallet-withdrawals", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("withdrawal_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const hasPending = (history ?? []).some((r) => r.status === "PENDING");

  const submit = async () => {
    const n = Number(amount);
    if (!n || n < 500) return toast.error("Minimum withdrawal is ₹500");
    if (n > balance) return toast.error("Insufficient balance");
    if (!details || details.length < 6) return toast.error(method === "UPI" ? "Enter UPI ID" : "Enter bank details (acc / ifsc / name)");
    if (hasPending) return toast.error("You already have a pending withdrawal");
    setBusy(true);
    try {
      const bank_details = method === "UPI" ? { upi: details } : { raw: details };
      const { error } = await supabase.from("withdrawal_requests").insert({
        user_id: userId, amount: n, method, bank_details, status: "PENDING",
      });
      if (error) throw error;
      toast.success("Withdrawal submitted");
      setDetails("");
      qc.invalidateQueries({ queryKey: ["wallet-withdrawals", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-display text-lg font-bold">Withdraw</h3>
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" min={500} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="text-[11px] text-muted-foreground mt-1">Min ₹500 · Available ₹{balance.toLocaleString("en-IN")}</p>
        </div>
        <div>
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as "UPI" | "BANK")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="BANK">Bank Account</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{method === "UPI" ? "UPI ID" : "Bank details"}</Label>
          {method === "UPI"
            ? <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="yourname@upi" />
            : <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Holder name, A/C number, IFSC, Bank" rows={3} />
          }
        </div>
        <Button className="w-full bg-gradient-gold text-background" onClick={submit} disabled={busy || hasPending}>
          {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : hasPending ? "Pending request exists" : "Request withdrawal"}
        </Button>
      </div>
      <div className="glass rounded-xl p-4 space-y-2">
        <h4 className="text-sm font-semibold">Recent withdrawals</h4>
        {history?.length === 0 && <p className="text-xs text-muted-foreground">No withdrawals yet.</p>}
        {history?.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-sm border border-border/40 rounded-md px-3 py-2">
            <div>
              <div className="font-mono">₹{Number(r.amount).toLocaleString("en-IN")} · {r.method}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <StatusBadge status={r.status} reason={r.reject_reason ?? undefined} />
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletHistory({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["wallet-tx", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallet_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="glass rounded-xl p-4 mt-4">
      {!data && <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 inline animate-spin" /></div>}
      {data && data.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</p>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs uppercase tracking-wider">
              <tr><th className="text-left p-2">Date</th><th className="text-left p-2">Type</th><th className="text-left p-2">Description</th><th className="text-right p-2">Amount</th><th className="text-right p-2">Balance</th></tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-t border-border/40">
                  <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="p-2"><Badge variant="outline">{t.type}</Badge></td>
                  <td className="p-2 text-xs">{t.description}</td>
                  <td className={`p-2 text-right font-mono ${Number(t.amount) >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                    {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toLocaleString("en-IN")}
                  </td>
                  <td className="p-2 text-right font-mono text-muted-foreground">{Number(t.balance_after).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, reason }: { status: string; reason?: string }) {
  const tone = status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : status === "REJECTED" ? "bg-destructive/15 text-destructive border-destructive/30"
    : "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${tone}`} title={reason}>
      {status}
    </span>
  );
}
