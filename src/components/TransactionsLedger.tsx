import { useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useWalletStore, TX_LABEL } from "@/stores/walletStore";
import { useBetStore } from "@/stores/betStore";
import type { Transaction, TransactionType, TransactionStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowDownRight, ArrowUpRight, Download, X } from "lucide-react";

const CREDIT_TYPES = new Set<TransactionType>([
  "DEPOSIT", "BET_WIN", "BET_REFUND", "BONUS", "REFERRAL_BONUS", "ADMIN_CREDIT",
]);

const STATUS_STYLES: Record<TransactionStatus, string> = {
  COMPLETED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  FAILED: "bg-destructive/15 text-destructive border-destructive/30",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

interface Props {
  /** Limit rows shown (e.g. dashboard preview). Omit for full history. */
  limit?: number;
  /** Hide the filter bar (compact embed). */
  compact?: boolean;
}

export function TransactionsLedger({ limit, compact }: Props) {
  const user = useAuthStore((s) => s.user);
  const walletTxns = useWalletStore((s) => s.transactions);
  const betTxns = useBetStore((s) => s.transactions);

  const [type, setType] = useState<TransactionType | "ALL">("ALL");
  const [status, setStatus] = useState<TransactionStatus | "ALL">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const all = useMemo(() => {
    if (!user) return [];
    // merge & dedupe by id
    const map = new Map<string, Transaction>();
    [...walletTxns, ...betTxns]
      .filter((t) => t.userId === user.id)
      .forEach((t) => map.set(t.id, t));
    return Array.from(map.values()).sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    );
  }, [walletTxns, betTxns, user]);

  const filtered = useMemo(() => {
    let rows = all;
    if (type !== "ALL") rows = rows.filter((t) => t.type === type);
    if (status !== "ALL") rows = rows.filter((t) => t.status === status);
    if (from) {
      const f = new Date(from + "T00:00:00").getTime();
      rows = rows.filter((t) => +new Date(t.createdAt) >= f);
    }
    if (to) {
      const e = new Date(to + "T23:59:59").getTime();
      rows = rows.filter((t) => +new Date(t.createdAt) <= e);
    }
    return rows;
  }, [all, type, status, from, to]);

  const display = limit ? filtered.slice(0, limit) : filtered;

  const totals = useMemo(() => {
    let credits = 0, debits = 0;
    for (const t of filtered) {
      if (t.status !== "COMPLETED") continue;
      if (CREDIT_TYPES.has(t.type)) credits += t.amount;
      else debits += t.amount;
    }
    return { credits, debits, net: credits - debits };
  }, [filtered]);

  const reset = () => { setType("ALL"); setStatus("ALL"); setFrom(""); setTo(""); };

  const exportCsv = () => {
    const head = ["Date", "Type", "Description", "Amount", "Direction", "Balance After", "Status"];
    const rows = filtered.map((t) => {
      const credit = CREDIT_TYPES.has(t.type);
      return [
        new Date(t.createdAt).toISOString(),
        TX_LABEL[t.type],
        (t.description ?? "").replace(/"/g, '""'),
        t.amount,
        credit ? "CREDIT" : "DEBIT",
        t.balanceAfter,
        t.status,
      ];
    });
    const csv = [head, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transactions-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass rounded-xl overflow-hidden">
      {!compact && (
        <div className="p-4 border-b border-border/60 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TransactionType | "ALL")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All types</SelectItem>
                  {Object.entries(TX_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TransactionStatus | "ALL")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={reset}><X className="h-4 w-4 mr-1" /> Reset</Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Credits" value={totals.credits} positive />
            <Stat label="Debits" value={totals.debits} />
            <Stat label="Net" value={totals.net} positive={totals.net >= 0} negative={totals.net < 0} />
          </div>
        </div>
      )}

      {display.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No transactions match these filters.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {display.map((t) => {
              const credit = CREDIT_TYPES.has(t.type);
              return (
                <TableRow key={t.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="flex items-center gap-1.5">
                      {credit
                        ? <ArrowDownRight className="h-3.5 w-3.5 text-emerald-400" />
                        : <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />}
                      {TX_LABEL[t.type]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                    {t.description ?? "—"}
                  </TableCell>
                  <TableCell className={`text-right font-mono whitespace-nowrap ${credit ? "text-emerald-400" : "text-destructive"}`}>
                    {credit ? "+" : "−"}₹{t.amount.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">
                    ₹{t.balanceAfter.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${STATUS_STYLES[t.status]} text-[10px]`}>
                      {t.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {limit && filtered.length > limit && (
        <div className="text-center py-3 text-xs text-muted-foreground border-t border-border/60">
          Showing {limit} of {filtered.length}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, positive, negative }: { label: string; value: number; positive?: boolean; negative?: boolean }) {
  const cls = positive ? "text-emerald-400" : negative ? "text-destructive" : "text-foreground";
  const sign = positive && value > 0 ? "+" : negative && value < 0 ? "−" : "";
  const abs = Math.abs(value);
  return (
    <div className="rounded-lg border border-border/40 bg-surface/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-bold ${cls}`}>{sign}₹{abs.toLocaleString("en-IN")}</div>
    </div>
  );
}
