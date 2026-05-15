import { useEffect, useMemo, useState } from "react";
import { useMarkets, useResultsForDate } from "@/hooks/useGameData";
import { todayIST } from "@/lib/marketTime";
import { splitTopMarkets } from "@/lib/topMarkets";

export function ResultsTicker() {
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const items = useMemo(() => {
    const { top } = splitTopMarkets(markets);
    return top.map((m) => {
      const r = results.find((x) => x.marketId === m.id);
      return {
        name: m.displayName,
        jodi: r?.jodi ?? "--",
        open: r?.openPana ?? "***",
        close: r?.closePana ?? "***",
      };
    });
  }, [markets, results]);

  if (!mounted) {
    return <div className="border-y border-border/60 bg-surface/60 h-9" suppressHydrationWarning />;
  }

  const row = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-2 text-sm whitespace-nowrap">
          <span className="text-muted-foreground">{it.name}</span>
          <span className="font-mono text-primary">{it.open}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-primary text-glow-gold font-bold">{it.jodi}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-primary">{it.close}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="border-y border-border/60 bg-surface/60 overflow-hidden">
      <div className="flex scrolling-ticker py-2">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
