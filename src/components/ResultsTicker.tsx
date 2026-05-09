import { useMarketStore } from "@/stores/marketStore";
import { useEffect, useState } from "react";

export function ResultsTicker() {
  const results = useMarketStore((s) => s.results);
  const markets = useMarketStore((s) => s.markets);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setMounted((x) => !x || true), 30000);
    return () => clearInterval(t);
  }, []);
  if (!mounted) {
    return <div className="border-y border-border/60 bg-surface/60 h-9" suppressHydrationWarning />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const items = markets.map((m) => {
    const r = results.find((x) => x.marketId === m.id && x.sessionDate === today)
          ?? results.find((x) => x.marketId === m.id);
    return {
      name: m.displayName,
      jodi: r?.jodi ?? "--",
      open: r?.openPana ?? "***",
      close: r?.closePana ?? "***",
    };
  });

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
