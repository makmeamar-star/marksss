import { useEffect, useState } from "react";

/** Returns ms remaining until target HH:MM today (or tomorrow if past). */
export function msUntil(targetHHMM: string): number {
  const [h, m] = targetHHMM.split(":").map(Number);
  const now = new Date();
  const t = new Date();
  t.setHours(h, m, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime() - now.getTime();
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600).toString().padStart(2, "0");
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

interface Props {
  targetTime: string; // HH:MM
  label?: string;
  onExpire?: () => void;
}

export function CountdownTimer({ targetTime, label, onExpire }: Props) {
  // SSR-safe: render placeholder until first effect tick on client
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    setMs(msUntil(targetTime));
    const i = setInterval(() => {
      const next = msUntil(targetTime);
      setMs(next);
      if (next <= 0 && onExpire) onExpire();
    }, 1000);
    return () => clearInterval(i);
  }, [targetTime, onExpire]);

  const display = ms === null ? "--:--:--" : formatDuration(ms);
  const mins = (ms ?? Infinity) / 1000 / 60;
  const tone =
    ms === null ? "text-muted-foreground" :
    mins < 1 ? "text-danger animate-pulse" :
    mins < 5 ? "text-danger" :
    mins < 30 ? "text-warning" :
    "text-success";

  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>}
      <span className={`font-mono text-sm font-semibold ${tone}`}>{display}</span>
    </div>
  );
}
