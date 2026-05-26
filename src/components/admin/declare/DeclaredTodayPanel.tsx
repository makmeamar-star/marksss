import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { declaredToday, type DeclaredMarketRow } from "@/lib/adminApi";
import { CorrectResultDialog } from "./CorrectResultDialog";
import { HardOverrideDialog, type HardOverrideRow } from "./HardOverrideDialog";

export function DeclaredTodayPanel() {
  const { data = [] } = useQuery({
    queryKey: ["declared-today"],
    queryFn: declaredToday,
    refetchInterval: 30_000,
  });
  const [editing, setEditing] = useState<DeclaredMarketRow | null>(null);
  const [overriding, setOverriding] = useState<HardOverrideRow | null>(null);

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm uppercase tracking-wider">Declared Today</h3>
        <Badge variant="outline" className="font-mono">{data.length}</Badge>
      </div>

      {data.length === 0 ? (
        <div className="text-xs text-muted-foreground p-4 text-center">No results declared yet.</div>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {data.map((d) => (
            <li key={d.sessionId} className="rounded-md border border-border/60 bg-card/50 p-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="font-semibold text-sm">{d.marketName} — {d.session}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 ml-5 font-mono">
                Pana {d.pana} · Digit {d.digit} · {format(new Date(d.declaredAt), "HH:mm")}
              </div>
              <div className="text-[11px] text-muted-foreground ml-5">
                By: {d.declaredBy}
              </div>
              <div className="ml-5 mt-1 flex items-center gap-3">
                {d.correctionWindowOpen ? (
                  <button
                    onClick={() => setEditing(d)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Correct ({Math.ceil(d.correctionRemainingMs / 60_000)}m left)
                  </button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Window expired</span>
                )}
                <button
                  onClick={() =>
                    setOverriding({
                      marketId: d.marketId,
                      marketName: d.marketName,
                      session: d.session,
                      sessionDate: new Date(d.declaredAt).toISOString().slice(0, 10),
                      pana: d.pana,
                    })
                  }
                  className="text-[11px] text-destructive hover:underline inline-flex items-center gap-1"
                >
                  <AlertTriangle className="h-3 w-3" /> Hard override
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CorrectResultDialog row={editing} onClose={() => setEditing(null)} />
      <HardOverrideDialog row={overriding} onClose={() => setOverriding(null)} />
    </div>
  );
}
