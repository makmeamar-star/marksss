import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberReveal } from "./NumberReveal";
import { CountdownTimer } from "./CountdownTimer";
import { ResultAlertBell } from "./ResultAlertBell";
import type { Market, MarketResult } from "@/lib/types";
import { isAcceptingBets } from "@/lib/marketTime";

interface Props {
  market: Market;
  result?: MarketResult;
  previousResult?: MarketResult;
  showPreviousFallback?: boolean;
  previousLoading?: boolean;
  previousError?: boolean;
  onRetryPrevious?: () => void;
}

export function ResultCard({
  market,
  result,
  previousResult,
  showPreviousFallback,
  previousLoading,
  previousError,
  onRetryPrevious,
}: Props) {
  const rawDeclared = result?.status === "DECLARED";
  // Ignore a pre-existing result row while the market is still accepting bets,
  // so a prematurely-scraped result doesn't show "DECLARED" before the cutoff.
  const [accepting, setAccepting] = useState(false);
  useEffect(() => {
    const check = () => setAccepting(isAcceptingBets(market));
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, [market]);
  const declared = rawDeclared && !accepting;
  const openText = result?.openPana && result?.openDigit !== undefined
    ? `${result.openPana}-${result.openDigit}`
    : undefined;
  const closeText = result?.closePana && result?.closeDigit !== undefined
    ? `${result.closeDigit}-${result.closePana}`
    : undefined;

  // Stale = past result time + 15m grace and still undeclared.
  // Computed only on the client to avoid SSR hydration mismatches.
  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    if (declared) { setIsStale(false); return; }
    const check = () => {
      const [h, m] = (market.resultTime ?? market.closeTime).split(":").map(Number);
      if (Number.isNaN(h)) return;
      const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
      const todayY = nowIst.getUTCFullYear(), todayM = nowIst.getUTCMonth(), todayD = nowIst.getUTCDate();
      const target = Date.UTC(todayY, todayM, todayD, h, (m ?? 0) + 15);
      setIsStale(nowIst.getTime() > target);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [declared, market.resultTime, market.closeTime]);

  const showFallbackSlot = !declared && !!showPreviousFallback;
  const usePrev = showFallbackSlot && previousResult?.status === "DECLARED";
  const showSkeleton = showFallbackSlot && !usePrev && !!previousLoading;
  const showError = showFallbackSlot && !usePrev && !previousLoading && !!previousError;

  const prevOpen = usePrev && previousResult?.openPana && previousResult?.openDigit !== undefined
    ? `${previousResult.openPana}-${previousResult.openDigit}` : undefined;
  const prevClose = usePrev && previousResult?.closePana && previousResult?.closeDigit !== undefined
    ? `${previousResult.closeDigit}-${previousResult.closePana}` : undefined;
  const prevDateLabel = usePrev && previousResult
    ? (() => {
        const [y, m, d] = previousResult.sessionDate.split("-").map(Number);
        // Use UTC to avoid local-timezone day shifts; sessionDate is already IST calendar date.
        return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(undefined, {
          day: "2-digit", month: "short", timeZone: "UTC",
        });
      })()
    : undefined;

  return (
    <div
      className={`glass mandala-corner rounded-xl p-2 sm:p-2.5 transition-all duration-150 hover:-translate-y-0.5 ${declared ? "ring-gold" : "hover:border-primary/40"}`}
    >
      <div className="flex items-start justify-between gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
        <div className="min-w-0">
          <h3 className="font-display text-xs sm:text-sm font-bold text-foreground truncate">{market.displayName}</h3>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">
            {market.openTime} — {market.closeTime}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {declared ? (
            <Badge className="bg-primary/15 text-primary border-primary/40 text-[10px] px-1.5 py-0">DECLARED</Badge>
          ) : accepting ? (
            <Badge className="bg-success/15 text-success border-success/40 pulse-live text-[10px] px-1.5 py-0">OPEN</Badge>
          ) : isStale ? (
            <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/40 text-[10px] px-1.5 py-0">PENDING</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">CLOSED</Badge>
          )}
          <ResultAlertBell marketId={market.id} />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center my-1 sm:my-1.5 gap-1 min-h-[32px] sm:min-h-[36px]">
        {showSkeleton ? (
          <div className="flex items-center gap-2" aria-busy="true" aria-label="Loading previous result">
            <Skeleton className="h-5 w-12" />
            <span className="text-muted-foreground/40">·</span>
            <Skeleton className="h-5 w-8" />
            <span className="text-muted-foreground/40">·</span>
            <Skeleton className="h-5 w-12" />
          </div>
        ) : showError ? (
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-muted-foreground/70 text-base md:text-lg">*** · ** · ***</span>
            {onRetryPrevious && (
              <button
                type="button"
                onClick={onRetryPrevious}
                className="text-[9px] uppercase tracking-widest text-primary hover:underline"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-center">
              {usePrev ? (
                <>
                  <span className="font-mono text-muted-foreground/80 text-sm md:text-base">{prevOpen ?? "***"}</span>
                  <span className="text-muted-foreground mx-0.5">·</span>
                  <span className="font-mono text-muted-foreground/80 text-sm md:text-base">{previousResult?.jodi ?? "**"}</span>
                  <span className="text-muted-foreground mx-0.5">·</span>
                  <span className="font-mono text-muted-foreground/80 text-sm md:text-base">{prevClose ?? "***"}</span>
                </>
              ) : (
                <>
                  <span className="font-mono text-primary text-sm md:text-base text-glow-diya">{openText ?? "***"}</span>
                  <span className="text-muted-foreground mx-0.5">·</span>
                  <NumberReveal value={result?.jodi} size="sm" />
                  <span className="text-muted-foreground mx-0.5">·</span>
                  <span className="font-mono text-primary text-sm md:text-base text-glow-diya">{closeText ?? "***"}</span>
                </>
              )}
            </div>
            {usePrev && (
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/80">
                Prev · {prevDateLabel}
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/60 gap-2">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground truncate">
          @ {market.resultTime}
        </span>
        {!declared && <CountdownTimer targetTime={market.resultTime} label="Reveals in" />}
      </div>
    </div>
  );
}
