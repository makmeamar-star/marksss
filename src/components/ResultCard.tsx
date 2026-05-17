import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberReveal } from "./NumberReveal";
import { CountdownTimer } from "./CountdownTimer";
import { ResultAlertBell } from "./ResultAlertBell";
import type { Market, MarketResult } from "@/lib/types";

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
  const declared = result?.status === "DECLARED";
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
    <motion.div
      whileHover={{ y: -3 }}
      className={`glass mandala-corner rounded-xl p-3 transition-shadow ${declared ? "ring-gold" : "hover:border-primary/40"}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="font-display text-base font-bold text-foreground">{market.displayName}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {market.openTime} — {market.closeTime}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {declared ? (
            <Badge className="bg-primary/15 text-primary border-primary/40 text-[10px] px-1.5 py-0">DECLARED</Badge>
          ) : market.isOpen ? (
            <Badge className="bg-success/15 text-success border-success/40 pulse-live text-[10px] px-1.5 py-0">OPEN</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">CLOSED</Badge>
          )}
          <ResultAlertBell marketId={market.id} />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center my-2 gap-1 min-h-[44px]">
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
            <div className="flex items-center gap-2 text-center">
              {usePrev ? (
                <>
                  <span className="font-mono text-muted-foreground/80 text-base md:text-lg">{prevOpen ?? "***"}</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="font-mono text-muted-foreground/80 text-base md:text-lg">{previousResult?.jodi ?? "**"}</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="font-mono text-muted-foreground/80 text-base md:text-lg">{prevClose ?? "***"}</span>
                </>
              ) : (
                <>
                  <span className="font-mono text-primary text-base md:text-lg text-glow-diya">{openText ?? "***"}</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <NumberReveal value={result?.jodi} size="sm" />
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="font-mono text-primary text-base md:text-lg text-glow-diya">{closeText ?? "***"}</span>
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

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
          Result @ {market.resultTime}
        </span>
        {!declared && <CountdownTimer targetTime={market.resultTime} label="Reveals in" />}
      </div>
    </motion.div>
  );
}
