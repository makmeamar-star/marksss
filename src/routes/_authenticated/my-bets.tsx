import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/stores/authStore";
import { useBetStore } from "@/stores/betStore";
import { useMarketStore } from "@/stores/marketStore";
import { BetBadge } from "./dashboard";

export const Route = createFileRoute("/_authenticated/my-bets")({
  head: () => ({ meta: [{ title: "My Bets — SattaKing Pro" }] }),
  component: MyBetsPage,
});

function MyBetsPage() {
  const user = useAuthStore((s) => s.user);
  const bets = useBetStore((s) => s.bets);
  const markets = useMarketStore((s) => s.markets);

  const [status, setStatus] = useState<string>("ALL");
  const [marketId, setMarketId] = useState<string>("ALL");
  const [date, setDate] = useState<string>("");

  const mine = useMemo(() => bets.filter((b) => b.userId === user?.id), [bets, user]);

  const filtered = mine.filter((b) =>
    (status === "ALL" || b.status === status) &&
    (marketId === "ALL" || b.marketId === marketId) &&
    (!date || b.sessionDate === date)
  );

  const sum = (key: "amount" | "winAmount") =>
    filtered.reduce((s, b) => s + ((b[key] as number) ?? 0), 0);

  const won = filtered.filter((b) => b.status === "WON");
  const lost = filtered.filter((b) => b.status === "LOST");
  const pending = filtered.filter((b) => b.status === "PENDING");
  const net = sum("winAmount") - sum("amount");

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">My Bets</h1>
        <p className="text-sm text-muted-foreground mt-1">All your placed bets, filtered and totalled.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label="Total Bets" value={String(filtered.length)} sub={`₹${sum("amount").toLocaleString("en-IN")}`} />
        <Tile label="Won" value={String(won.length)} sub={`₹${won.reduce((s, b) => s + (b.winAmount ?? 0), 0).toLocaleString("en-IN")}`} tone="success" />
        <Tile label="Lost" value={String(lost.length)} sub={`₹${lost.reduce((s, b) => s + b.amount, 0).toLocaleString("en-IN")}`} tone="danger" />
        <Tile label="Pending" value={String(pending.length)} />
        <Tile label="Net P&L" value={`₹${net.toLocaleString("en-IN")}`} tone={net >= 0 ? "success" : "danger"} accent />
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 flex flex-wrap items-end gap-3">
        <FilterBox label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 bg-surface border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["ALL","PENDING","WON","LOST","CANCELLED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBox>
        <FilterBox label="Market">
          <Select value={marketId} onValueChange={setMarketId}>
            <SelectTrigger className="w-44 bg-surface border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All markets</SelectItem>
              {markets.map((m) => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBox>
        <FilterBox label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 bg-surface border-border" />
        </FilterBox>
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No bets match your filters.{" "}
            <Link to="/markets" className="text-primary hover:underline">Place your first bet →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface/60 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-xs uppercase">Date</th>
                  <th className="px-4 py-2.5 text-xs uppercase">Market</th>
                  <th className="px-4 py-2.5 text-xs uppercase">Session</th>
                  <th className="px-4 py-2.5 text-xs uppercase">Type</th>
                  <th className="px-4 py-2.5 text-xs uppercase">Number</th>
                  <th className="px-4 py-2.5 text-xs uppercase">Stake</th>
                  <th className="px-4 py-2.5 text-xs uppercase">Status</th>
                  <th className="px-4 py-2.5 text-xs uppercase">Win</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const m = markets.find((x) => x.id === b.marketId);
                  return (
                    <tr key={b.id} className="border-t border-border/50">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{b.sessionDate}</td>
                      <td className="px-4 py-2.5">{m?.displayName ?? b.marketId}</td>
                      <td className="px-4 py-2.5 text-xs">{b.session}</td>
                      <td className="px-4 py-2.5 text-xs">{b.betType}</td>
                      <td className="px-4 py-2.5 font-mono text-primary">{b.betNumber}</td>
                      <td className="px-4 py-2.5 font-mono">₹{b.amount}</td>
                      <td className="px-4 py-2.5"><BetBadge status={b.status} /></td>
                      <td className="px-4 py-2.5 font-mono text-success">{b.winAmount ? `₹${b.winAmount.toLocaleString("en-IN")}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone, accent }: { label: string; value: string; sub?: string; tone?: "success" | "danger"; accent?: boolean }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className={`glass rounded-xl p-4 ${accent ? "ring-gold" : ""}`}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function FilterBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
