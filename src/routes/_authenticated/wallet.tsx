import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpToLine, History, Loader2, Copy, Check, QrCode, Banknote, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { PromoRedeemCard, CashbackCard } from "@/components/wallet/PromoCashback";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — SattaKing Pro" }] }),
  component: WalletPage,
});

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

      <div className="grid md:grid-cols-2 gap-4">
        <PromoRedeemCard userId={user.id} />
        <CashbackCard userId={user.id} />
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

type Channel = {
  id: string; type: "UPI" | "BANK" | "QR"; label: string;
  details: Record<string, string>; qr_image_url: string | null;
  instructions: string | null; priority: number;
  min_amount: number; max_amount: number;
};
type Method = {
  id: string; type: "UPI" | "BANK"; label: string;
  min_amount: number; max_amount: number; fee_pct: number;
  instructions: string | null; priority: number;
};

function DepositForm({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("500");
  const [channelId, setChannelId] = useState<string>("");
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: channels } = useQuery({
    queryKey: ["payment-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_channels").select("*")
        .eq("active", true).order("priority");
      if (error) throw error;
      return (data ?? []) as Channel[];
    },
  });

  const selected = useMemo(
    () => channels?.find((c) => c.id === channelId) ?? channels?.[0],
    [channels, channelId],
  );

  const { data: pending } = useQuery({
    queryKey: ["wallet-deposits", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_requests").select("*")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!selected) return toast.error("No deposit channel available — please contact support");
    const n = Number(amount);
    if (!n || n < selected.min_amount) return toast.error(`Minimum deposit is ₹${selected.min_amount}`);
    if (n > selected.max_amount) return toast.error(`Maximum deposit is ₹${selected.max_amount}`);
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
      const method = selected.type === "BANK" ? "BANK" : "UPI";
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

  const noChannels = channels && channels.length === 0;

  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-display text-lg font-bold">Add Funds</h3>
        {noChannels && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs p-3">
            No deposit channels are active right now. Please check back shortly.
          </div>
        )}
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" min={selected?.min_amount ?? 100} max={selected?.max_amount ?? 100000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex gap-2 mt-2">
            {[500, 1000, 2500, 5000].map((v) => (
              <button key={v} type="button" className="flex-1 rounded-md border border-border/60 py-1 text-xs hover:border-primary/50" onClick={() => setAmount(String(v))}>
                ₹{v}
              </button>
            ))}
          </div>
        </div>
        {channels && channels.length > 1 && (
          <div>
            <Label>Pay via</Label>
            <Select value={selected?.id ?? ""} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.type} · {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>UTR / Reference *</Label>
          <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 4234567890" />
        </div>
        <div>
          <Label>Screenshot (optional)</Label>
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button className="w-full bg-gradient-gold text-background" onClick={submit} disabled={busy || noChannels}>
          {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : "I have paid — submit"}
        </Button>
      </div>

      <div className="space-y-4">
        {selected && <ChannelDisplay channel={selected} />}
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

function ChannelDisplay({ channel }: { channel: Channel }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${key} copied`);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  };

  const bankDetails = channel.type === "BANK" && channel.details.account_number && channel.details.ifsc
    ? `A/C: ${channel.details.account_number}\nIFSC: ${channel.details.ifsc}\nHolder: ${channel.details.holder ?? ""}\nBank: ${channel.details.bank_name ?? ""}`
    : null;

  return (
    <div className="glass-gold rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        {channel.type === "UPI" && <Smartphone className="h-5 w-5 text-primary" />}
        {channel.type === "BANK" && <Banknote className="h-5 w-5 text-primary" />}
        {channel.type === "QR" && <QrCode className="h-5 w-5 text-primary" />}
        <div className="font-display font-bold">{channel.label}</div>
      </div>
      {channel.qr_image_url && (
        <img src={channel.qr_image_url} alt="Pay QR" className="mx-auto h-44 w-44 object-contain rounded-lg bg-background/40 border border-primary/30 p-2" />
      )}
      {channel.type === "UPI" && channel.details.vpa && (
        <CopyRow label="UPI ID" value={channel.details.vpa} copied={copiedKey === "UPI ID"} onCopy={() => copy(channel.details.vpa, "UPI ID")} />
      )}
      {channel.type === "BANK" && (
        <div className="space-y-2 text-sm">
          {channel.details.holder && <Row label="Holder" value={channel.details.holder} />}
          {channel.details.account_number && (
            <CopyRow label="Account No" value={channel.details.account_number} copied={copiedKey === "Account No"} onCopy={() => copy(channel.details.account_number!, "Account No")} />
          )}
          {channel.details.ifsc && (
            <CopyRow label="IFSC" value={channel.details.ifsc} copied={copiedKey === "IFSC"} onCopy={() => copy(channel.details.ifsc!, "IFSC")} />
          )}
          {channel.details.bank_name && <Row label="Bank" value={channel.details.bank_name} />}
          {bankDetails && (
            <Button size="sm" variant="outline" className="w-full mt-1 gap-1.5 text-xs" onClick={() => copy(bankDetails, "All Bank Details")}>
              <Copy className="h-3.5 w-3.5" /> Copy All Bank Details
            </Button>
          )}
        </div>
      )}
      {channel.instructions && (
        <p className="text-[11px] text-amber-400/90 border-t border-primary/20 pt-2">{channel.instructions}</p>
      )}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{label}</span><span className="font-mono">{value}</span></div>;
}
function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-primary text-right max-w-[180px] truncate" title={value}>{value}</span>
        <Button size="sm" variant="secondary" className="h-7 px-2 gap-1 text-xs" onClick={onCopy}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function WithdrawForm({ userId, balance }: { userId: string; balance: number }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("500");
  const [methodId, setMethodId] = useState<string>("");
  const [details, setDetails] = useState("");

  const [busy, setBusy] = useState(false);

  const { data: methods } = useQuery({
    queryKey: ["withdrawal-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_methods").select("*")
        .eq("active", true).order("priority");
      if (error) throw error;
      return (data ?? []) as Method[];
    },
  });
  const selected = useMemo(
    () => methods?.find((m) => m.id === methodId) ?? methods?.[0],
    [methods, methodId],
  );

  const { data: history } = useQuery({
    queryKey: ["wallet-withdrawals", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("withdrawal_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const hasPending = (history ?? []).some((r) => r.status === "PENDING");
  const noMethods = methods && methods.length === 0;

  const submit = async () => {
    if (!selected) return toast.error("No withdrawal method available");
    const n = Number(amount);
    if (!n || n < selected.min_amount) return toast.error(`Minimum withdrawal is ₹${selected.min_amount}`);
    if (n > selected.max_amount) return toast.error(`Maximum withdrawal is ₹${selected.max_amount}`);
    if (n > balance) return toast.error("Insufficient balance");
    if (!details || details.length < 6) return toast.error(selected.type === "UPI" ? "Enter UPI ID" : "Enter bank details (acc / ifsc / name)");
    if (hasPending) return toast.error("You already have a pending withdrawal");
    setBusy(true);
    try {
      const bank_details = selected.type === "UPI" ? { upi: details } : { raw: details };
      const { error } = await supabase.from("withdrawal_requests").insert({
        user_id: userId, amount: n, method: selected.type, bank_details, status: "PENDING",
      });
      if (error) throw error;
      toast.success("Withdrawal submitted");
      setDetails("");
      qc.invalidateQueries({ queryKey: ["wallet-withdrawals", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally { setBusy(false); }
  };

  const fee = selected ? (Number(amount) || 0) * (selected.fee_pct / 100) : 0;
  const net = Math.max(0, (Number(amount) || 0) - fee);

  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-display text-lg font-bold">Withdraw</h3>
        {noMethods && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs p-3">
            Withdrawals are temporarily unavailable. Please check back later.
          </div>
        )}
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" min={selected?.min_amount ?? 500} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="text-[11px] text-muted-foreground mt-1">
            Min ₹{selected?.min_amount ?? 500} · Available ₹{balance.toLocaleString("en-IN")}
            {selected && selected.fee_pct > 0 && ` · Fee ${selected.fee_pct}% → you receive ₹${net.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
          </p>
        </div>
        {methods && methods.length > 1 && (
          <div>
            <Label>Method</Label>
            <Select value={selected?.id ?? ""} onValueChange={setMethodId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>{selected?.type === "UPI" ? "UPI ID" : "Bank details"}</Label>
          {selected?.type === "UPI"
            ? <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="yourname@upi" />
            : <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Holder name, A/C number, IFSC, Bank" rows={3} />
          }
        </div>
        {selected?.instructions && (
          <p className="text-[11px] text-muted-foreground">{selected.instructions}</p>
        )}
        <Button className="w-full bg-gradient-gold text-background" onClick={submit} disabled={busy || hasPending || noMethods}>
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
  const tone =
    status === "PAID" ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/40"
    : status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : status === "DECLINED" || status === "REJECTED" ? "bg-destructive/15 text-destructive border-destructive/30"
    : "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${tone}`} title={reason}>
      {status}
    </span>
  );
}
