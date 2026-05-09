import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { useWalletStore, TX_LABEL, type BankAccount, type UpiId } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowDownToLine, ArrowUpToLine, QrCode, Wallet, Trash2, Plus, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — SattaKing Pro" }] }),
  component: WalletPage,
});

const DEMO_UPI = "sattakingpro@upi";

function WalletPage() {
  const user = useAuthStore((s) => s.user);
  const wallet = useWalletStore();
  if (!user) return null;
  const txns = wallet.transactionsForUser(user.id);
  const todayPnL = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return txns
      .filter((t) => t.createdAt.slice(0, 10) === today && t.status === "COMPLETED")
      .reduce((s, t) => {
        if (t.type === "BET_WIN" || t.type === "BET_REFUND") return s + t.amount;
        if (t.type === "BET_PLACED") return s - t.amount;
        return s;
      }, 0);
  }, [txns]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Wallet</h1>
          <p className="text-sm text-muted-foreground">Manage your funds, payouts, and ledger.</p>
        </div>
      </header>

      <div className="grid sm:grid-cols-3 gap-3">
        <KpiCard label="Available Balance" value={`₹${user.balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} accent />
        <KpiCard label="Today's P&L" value={`${todayPnL >= 0 ? "+" : ""}₹${todayPnL.toLocaleString("en-IN")}`} positive={todayPnL >= 0} />
        <KpiCard label="Lifetime Deposits" value={`₹${user.totalDeposit.toLocaleString("en-IN")}`} />
      </div>

      <Tabs defaultValue="deposit">
        <TabsList className="bg-surface border border-border/60">
          <TabsTrigger value="deposit"><ArrowDownToLine className="h-4 w-4 mr-1" /> Deposit</TabsTrigger>
          <TabsTrigger value="withdraw"><ArrowUpToLine className="h-4 w-4 mr-1" /> Withdraw</TabsTrigger>
          <TabsTrigger value="transactions"><Wallet className="h-4 w-4 mr-1" /> Transactions</TabsTrigger>
          <TabsTrigger value="methods"><QrCode className="h-4 w-4 mr-1" /> Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit"><DepositForm /></TabsContent>
        <TabsContent value="withdraw"><WithdrawForm /></TabsContent>
        <TabsContent value="transactions"><TransactionsTable /></TabsContent>
        <TabsContent value="methods"><PaymentMethods /></TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, accent, positive }: { label: string; value: string; accent?: boolean; positive?: boolean }) {
  return (
    <div className={`${accent ? "glass-gold" : "glass"} rounded-xl p-4`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono text-2xl font-bold mt-1 ${accent ? "text-primary text-glow-gold" : positive === false ? "text-destructive" : positive ? "text-emerald-400" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}

function DepositForm() {
  const [amount, setAmount] = useState("500");
  const [method, setMethod] = useState<"UPI" | "BANK" | "QR">("UPI");
  const [reference, setReference] = useState("");
  const requestDeposit = useWalletStore((s) => s.requestDeposit);
  const submit = () => {
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    const r = requestDeposit({ amount: n, method, reference });
    if (!r.ok) return toast.error(r.error!);
    toast.success("Deposit submitted for approval");
    setReference("");
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
              <button key={v} className="flex-1 rounded-md border border-border/60 py-1 text-xs hover:border-primary/50" onClick={() => setAmount(String(v))}>
                ₹{v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as "UPI" | "BANK" | "QR")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UPI">UPI Transfer</SelectItem>
              <SelectItem value="QR">Scan QR</SelectItem>
              <SelectItem value="BANK">Bank Transfer (IMPS/NEFT)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>UTR / Reference (optional)</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 4234567890" />
        </div>
        <Button className="w-full bg-gradient-gold text-background" onClick={submit}>I have paid — submit</Button>
      </div>

      <div className="glass-gold rounded-xl p-5 space-y-3 text-center">
        <h3 className="font-display text-lg font-bold">Pay to</h3>
        <div className="mx-auto h-44 w-44 grid place-items-center rounded-lg bg-background/40 border border-primary/30">
          <QrCode className="h-32 w-32 text-primary/80" />
        </div>
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="font-mono text-primary">{DEMO_UPI}</span>
          <button onClick={() => { navigator.clipboard.writeText(DEMO_UPI); toast.success("UPI copied"); }} className="text-muted-foreground hover:text-primary">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">After paying, enter the UTR and submit. Admin approves within 5 minutes (mock).</p>
      </div>
    </div>
  );
}

function WithdrawForm() {
  const user = useAuthStore((s) => s.user)!;
  const banks = useWalletStore((s) => s.banks).filter((b) => b.userId === user.id);
  const upis = useWalletStore((s) => s.upis).filter((u) => u.userId === user.id);
  const requestWithdraw = useWalletStore((s) => s.requestWithdraw);
  const [amount, setAmount] = useState("500");
  const [destination, setDestination] = useState<string>("");

  const options = [
    ...upis.map((u) => ({ id: u.id, type: "UPI" as const, label: `UPI · ${u.upi}` })),
    ...banks.map((b) => ({ id: b.id, type: "BANK" as const, label: `${b.bankName} · ****${b.accountNumber.slice(-4)}` })),
  ];

  const submit = () => {
    const n = Number(amount);
    if (!n) return toast.error("Enter a valid amount");
    const opt = options.find((o) => o.id === destination);
    if (!opt) return toast.error("Select a payout method");
    const r = requestWithdraw({ amount: n, destinationType: opt.type, destinationId: opt.id, destinationLabel: opt.label });
    if (!r.ok) return toast.error(r.error!);
    toast.success("Withdrawal submitted");
  };

  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="font-display text-lg font-bold">Withdraw</h3>
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" min={500} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="text-[11px] text-muted-foreground mt-1">Min ₹500 · Available ₹{user.balance.toLocaleString("en-IN")}</p>
        </div>
        <div>
          <Label>Send to</Label>
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground border border-dashed border-border/60 rounded-md p-3">
              No payout methods. Add one in the Methods tab first.
            </p>
          ) : (
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger><SelectValue placeholder="Choose method" /></SelectTrigger>
              <SelectContent>
                {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button className="w-full bg-gradient-gold text-background" disabled={options.length === 0} onClick={submit}>
          Request withdrawal
        </Button>
      </div>
      <div className="glass rounded-xl p-5 text-sm text-muted-foreground space-y-2">
        <h3 className="font-display text-lg font-bold text-foreground">How it works</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Funds are held immediately when you request.</li>
          <li>Admin reviews within 30 minutes (mock).</li>
          <li>On approval, money lands in your account; on rejection, it's refunded.</li>
        </ol>
      </div>
    </div>
  );
}

function TransactionsTable() {
  const user = useAuthStore((s) => s.user)!;
  const txns = useWalletStore((s) => s.transactions).filter((t) => t.userId === user.id);
  const [filter, setFilter] = useState<string>("ALL");
  const filtered = filter === "ALL" ? txns : txns.filter((t) => t.type === filter);

  return (
    <div className="glass rounded-xl mt-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-3 border-b border-border/60">
        <h3 className="font-display text-lg font-bold">Transaction history</h3>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {Object.entries(TX_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No transactions yet.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => {
              const isCredit = ["DEPOSIT", "BET_WIN", "BET_REFUND", "BONUS", "REFERRAL_BONUS", "ADMIN_CREDIT"].includes(t.type);
              return (
                <TableRow key={t.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{TX_LABEL[t.type]}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">{t.description}</TableCell>
                  <TableCell className={`text-right font-mono ${isCredit ? "text-emerald-400" : "text-destructive"}`}>
                    {isCredit ? "+" : "-"}₹{t.amount.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">₹{t.balanceAfter.toLocaleString("en-IN")}</TableCell>
                  <TableCell><StatusPill status={t.status} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    FAILED: "bg-destructive/15 text-destructive border-destructive/30",
    CANCELLED: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={`${map[status] ?? ""} text-[10px]`}>{status}</Badge>;
}

function PaymentMethods() {
  const user = useAuthStore((s) => s.user)!;
  const wallet = useWalletStore();
  const banks = wallet.banks.filter((b) => b.userId === user.id);
  const upis = wallet.upis.filter((u) => u.userId === user.id);
  const [upi, setUpi] = useState("");
  const [bank, setBank] = useState({ holderName: "", accountNumber: "", ifsc: "", bankName: "" });

  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="font-display text-lg font-bold">UPI IDs</h3>
        <div className="flex gap-2">
          <Input placeholder="yourname@upi" value={upi} onChange={(e) => setUpi(e.target.value)} />
          <Button onClick={() => {
            if (!/^.+@.+$/.test(upi)) return toast.error("Invalid UPI ID");
            wallet.addUpi({ userId: user.id, upi });
            setUpi(""); toast.success("UPI added");
          }}><Plus className="h-4 w-4" /></Button>
        </div>
        <ul className="space-y-1.5">
          {upis.length === 0 && <li className="text-xs text-muted-foreground">No UPI IDs added.</li>}
          {upis.map((u: UpiId) => (
            <li key={u.id} className="flex items-center justify-between border border-border/40 rounded-md px-3 py-2 text-sm">
              <span className="font-mono text-primary">{u.upi}</span>
              <button className="text-muted-foreground hover:text-destructive" onClick={() => wallet.removeUpi(u.id)}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="font-display text-lg font-bold">Bank Accounts</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Holder name" value={bank.holderName} onChange={(e) => setBank({ ...bank, holderName: e.target.value })} />
          <Input placeholder="Bank name" value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
          <Input placeholder="Account number" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} />
          <Input placeholder="IFSC" value={bank.ifsc} onChange={(e) => setBank({ ...bank, ifsc: e.target.value.toUpperCase() })} />
        </div>
        <Button className="w-full" variant="outline" onClick={() => {
          if (!bank.holderName || !bank.accountNumber || !bank.ifsc || !bank.bankName) return toast.error("Fill all bank fields");
          wallet.addBank({ userId: user.id, ...bank });
          setBank({ holderName: "", accountNumber: "", ifsc: "", bankName: "" });
          toast.success("Bank added");
        }}>Add bank</Button>
        <ul className="space-y-1.5">
          {banks.length === 0 && <li className="text-xs text-muted-foreground">No bank accounts added.</li>}
          {banks.map((b: BankAccount) => (
            <li key={b.id} className="flex items-center justify-between border border-border/40 rounded-md px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{b.bankName}</div>
                <div className="text-[11px] text-muted-foreground font-mono">****{b.accountNumber.slice(-4)} · {b.ifsc}</div>
              </div>
              <button className="text-muted-foreground hover:text-destructive" onClick={() => wallet.removeBank(b.id)}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
