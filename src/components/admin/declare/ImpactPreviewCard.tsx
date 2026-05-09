import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useDeclareForm } from "@/stores/declareFormStore";
import { useMarketStore } from "@/stores/marketStore";
import { isValidPana } from "@/lib/panaChart";
import { impactPreview } from "@/lib/adminApi";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

const BET_TYPE_LABEL: Record<string, string> = {
  SINGLE_OPEN: "Single Open",
  SINGLE_CLOSE: "Single Close",
  JODI: "Jodi",
  SINGLE_PANA: "Single Pana",
  DOUBLE_PANA: "Double Pana",
  TRIPLE_PANA: "Triple Pana",
  HALF_SANGAM: "Half Sangam",
  FULL_SANGAM: "Full Sangam",
};

export function ImpactPreviewCard() {
  const { marketId, session, date, pana } = useDeclareForm();
  const debounced = useDebounce(pana, 500);
  const valid = pana.length === 3 && isValidPana(pana);
  const market = useMarketStore((s) => s.markets.find((m) => m.id === marketId));
  const [expanded, setExpanded] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["impact", marketId, session, date, debounced],
    queryFn: () =>
      marketId && isValidPana(debounced)
        ? impactPreview({ marketId, session, sessionDate: date, pana: debounced })
        : Promise.resolve(null),
    enabled: !!marketId && isValidPana(debounced),
    staleTime: 30_000,
  });

  return (
    <div
      className={cn(
        "rounded-2xl bg-card border border-border/60 border-t-2 p-5",
        data && data.netImpact >= 0 ? "border-l-4 border-l-success" :
        data && data.netImpact < 0 ? "border-l-4 border-l-destructive" :
        "border-t-primary",
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-primary">Step 3</div>
          <h2 className="font-display text-xl font-bold">Review Financial Impact</h2>
        </div>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {!valid ? (
        <div className="text-sm text-muted-foreground p-6 text-center border border-dashed border-border rounded-lg">
          Enter a valid pana above to see financial impact.
        </div>
      ) : isFetching && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="text-xs text-muted-foreground text-center mt-2">Calculating impact…</div>
        </div>
      ) : data ? (
        <>
          <div className="text-xs text-muted-foreground mb-3">
            <span className="font-display font-bold text-foreground">{market?.displayName}</span>{" "}
            {session} — Pana <span className="font-mono">{pana}</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-card/70 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Bet Type</th>
                  <th className="text-right px-3 py-2">Wins</th>
                  <th className="text-right px-3 py-2">Bet</th>
                  <th className="text-right px-3 py-2">Payout</th>
                </tr>
              </thead>
              <tbody>
                {data.winningBets.byType.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                    No winners for this pana.
                  </td></tr>
                ) : data.winningBets.byType.map((row) => (
                  <tr key={row.betType} className="border-t border-border/40">
                    <td className="px-3 py-2">{BET_TYPE_LABEL[row.betType] ?? row.betType}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.count}</td>
                    <td className="px-3 py-2 text-right font-mono">₹{row.amount.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right font-mono text-success">
                      ₹{row.payout.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Stat label="Winning bets" value={`${data.winningBets.count}`} />
            <Stat label="Losing bets" value={`${data.losingBets.count}`} />
            <Stat label="Total bet" value={`₹${data.totalBetAmount.toLocaleString("en-IN")}`} />
            <Stat
              label="Net impact"
              value={`${data.netImpact >= 0 ? "+" : ""}₹${data.netImpact.toLocaleString("en-IN")}`}
              tone={data.netImpact >= 0 ? "success" : "destructive"}
            />
          </div>

          {data.warning && (
            <div className={cn(
              "mt-4 rounded-lg p-3 flex items-start gap-2 text-sm",
              data.warning === "EXTREME_PAYOUT"
                ? "bg-destructive/15 border border-destructive/40 text-destructive"
                : "bg-warning/10 border border-primary/40 text-primary"
            )}>
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold">
                  {data.warning === "EXTREME_PAYOUT" ? "EXTREME PAYOUT WARNING" : "HIGH PAYOUT WARNING"}
                </div>
                <div className="text-xs opacity-80">
                  Payout {data.warning === "EXTREME_PAYOUT" ? "exceeds bet collection by 5×" : "exceeds bet collection by 1.5×"}.
                  Verify result carefully before declaring.
                  {data.warning === "EXTREME_PAYOUT" && " Secondary admin approval recommended."}
                </div>
              </div>
            </div>
          )}

          {data.netImpact >= 0 && (
            <div className="mt-3 rounded-md bg-success/10 border border-success/30 text-success text-xs px-3 py-2 inline-flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" /> Profitable session
            </div>
          )}
          {data.netImpact < 0 && !data.warning && (
            <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2 inline-flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5" /> Net loss session
            </div>
          )}

          {data.topWinners.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? "Hide" : "View"} top winners
              </button>
              {expanded && (
                <ul className="mt-2 space-y-1 text-sm">
                  {data.topWinners.map((w, i) => (
                    <li key={i} className="flex justify-between font-mono">
                      <span className="text-muted-foreground">{w.usernameMasked}</span>
                      <span className="text-success">₹{w.amount.toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/60 p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn(
        "font-mono text-base font-bold mt-0.5",
        tone === "success" && "text-success",
        tone === "destructive" && "text-destructive",
      )}>{value}</div>
    </div>
  );
}
