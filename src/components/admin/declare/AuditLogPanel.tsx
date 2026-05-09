import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuditStore, type AuditEntry } from "@/stores/auditStore";
import { cn } from "@/lib/utils";

export function AuditLogPanel() {
  const entries = useAuditStore((s) => s.entries);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "DECLARED" | "CORRECTED" | "CANCELLED">("ALL");

  const sevenDayCutoff = Date.now() - 7 * 86_400_000;
  const visible = useMemo(() => {
    return entries
      .filter((e) => new Date(e.ts).getTime() >= sevenDayCutoff)
      .filter((e) => filter === "ALL" || e.action === filter);
  }, [entries, filter, sevenDayCutoff]);

  return (
    <div className="rounded-2xl bg-card border border-border/60 mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-sm uppercase tracking-wider">Result Audit Log</span>
          <Badge variant="outline" className="font-mono">{visible.length}</Badge>
          <span className="text-xs text-muted-foreground">last 7 days</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-border/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {(["ALL", "DECLARED", "CORRECTED", "CANCELLED"] as const).map((k) => (
                <Button
                  key={k}
                  variant={filter === k ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilter(k)}
                >
                  {k}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => exportCSV(visible)}>
              <Download className="h-3 w-3 mr-1" /> Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-card/70 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-2">Time</th>
                  <th className="text-left px-2 py-2">Admin</th>
                  <th className="text-left px-2 py-2">Action</th>
                  <th className="text-left px-2 py-2">Market</th>
                  <th className="text-left px-2 py-2">Session</th>
                  <th className="text-left px-2 py-2">Old → New</th>
                  <th className="text-left px-2 py-2">Reason</th>
                  <th className="text-right px-2 py-2">Bets</th>
                  <th className="text-right px-2 py-2">Payout</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={9} className="text-center px-2 py-6 text-muted-foreground">
                    No entries.
                  </td></tr>
                ) : visible.map((e) => (
                  <tr key={e.id} className="border-t border-border/40">
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{format(new Date(e.ts), "dd/MM HH:mm")}</td>
                    <td className="px-2 py-1.5">{e.adminEmail}</td>
                    <td className="px-2 py-1.5">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                        e.action === "DECLARED" && "bg-success/15 text-success",
                        e.action === "CORRECTED" && "bg-primary/15 text-primary",
                        e.action === "CANCELLED" && "bg-destructive/15 text-destructive",
                      )}>{e.action}</span>
                    </td>
                    <td className="px-2 py-1.5">{e.marketName}</td>
                    <td className="px-2 py-1.5">{e.session}</td>
                    <td className="px-2 py-1.5 font-mono">
                      {e.oldPana ? <>{e.oldPana} → {e.newPana}</> : (e.newPana ?? "—")}
                    </td>
                    <td className="px-2 py-1.5 max-w-32 truncate text-muted-foreground" title={e.reason}>
                      {e.reason ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{e.betsAffected}</td>
                    <td className="px-2 py-1.5 text-right font-mono">₹{e.payout.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function exportCSV(entries: AuditEntry[]) {
  const header = ["Timestamp", "Admin", "Action", "Market", "Session", "Old Pana", "New Pana", "Reason", "Bets", "Payout"];
  const rows = entries.map((e) => [
    e.ts, e.adminEmail, e.action, e.marketName, e.session,
    e.oldPana ?? "", e.newPana ?? "", (e.reason ?? "").replace(/"/g, '""'),
    String(e.betsAffected), String(e.payout),
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${c}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
