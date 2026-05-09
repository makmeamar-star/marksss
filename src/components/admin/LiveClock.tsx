import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function format(date: Date, compact: boolean): string {
  const opts: Intl.DateTimeFormatOptions = compact
    ? { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }
    : {
        timeZone: "Asia/Kolkata",
        weekday: "long", day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      };
  const fmt = new Intl.DateTimeFormat("en-GB", opts).format(date);
  return compact ? `${fmt} IST` : `${fmt} IST`;
}

export function LiveClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      suppressHydrationWarning
      className={`inline-flex items-center gap-2 font-mono ${
        compact
          ? "text-xs text-muted-foreground"
          : "text-sm text-foreground/80 px-3 py-1.5 rounded-md border border-border/60 bg-card/60"
      }`}
    >
      <Clock className={compact ? "h-3.5 w-3.5" : "h-4 w-4 text-primary"} />
      <span>{now ? format(now, compact) : "—"}</span>
    </div>
  );
}
