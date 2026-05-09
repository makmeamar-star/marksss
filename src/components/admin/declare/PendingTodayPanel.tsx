import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pendingToday } from "@/lib/adminApi";
import { useDeclareForm } from "@/stores/declareFormStore";
import { cn } from "@/lib/utils";

export function PendingTodayPanel() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["pending-today"],
    queryFn: pendingToday,
    refetchInterval: 60_000,
  });
  const prefill = useDeclareForm((s) => s.prefill);

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm uppercase tracking-wider">Pending Today</h3>
        <Badge variant="outline" className="font-mono">{data.length}</Badge>
      </div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : data.length === 0 ? (
        <div className="text-xs text-muted-foreground p-4 text-center">
          🎉 All results declared for today.
        </div>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {data.map((row) => {
            const overdue = row.overdueMinutes >= 0;
            const dueSoon = !overdue && row.overdueMinutes > -120;
            const dotColor = overdue ? "text-destructive" : dueSoon ? "text-primary" : "text-success";
            return (
              <li key={`${row.marketId}-${row.session}`}
                className={cn(
                  "rounded-md border p-2.5 bg-card/50",
                  overdue ? "border-destructive/40" : "border-border/60",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("inline-block h-2 w-2 rounded-full bg-current", dotColor)} />
                  <span className="font-semibold text-sm">{row.marketName} — {row.session}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 ml-4">
                  Expected at {row.resultTime}
                  {row.totalBets > 0 && ` · ${row.totalBets} bets · ₹${row.totalBetAmount.toLocaleString("en-IN")}`}
                </div>
                <div className="ml-4 mt-1 flex items-center justify-between">
                  <span className={cn(
                    "text-[11px] inline-flex items-center gap-1 font-mono",
                    overdue ? "text-destructive" : dueSoon ? "text-primary" : "text-muted-foreground",
                  )}>
                    <Clock className="h-3 w-3" />
                    {overdue ? `Overdue by ${row.overdueMinutes}m` : `Due in ${formatRel(-row.overdueMinutes)}`}
                  </span>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 text-[11px] text-primary hover:text-primary"
                    onClick={() => prefill(row.marketId, row.session)}
                  >
                    Declare Now <ArrowRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatRel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}
