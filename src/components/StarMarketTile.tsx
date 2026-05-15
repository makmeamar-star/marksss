import { Link } from "@tanstack/react-router";
import { Star, ArrowRight } from "lucide-react";
import type { Market, MarketResult } from "@/lib/types";

interface Props {
  market: Market;
  result?: MarketResult;
  recentJodis?: string[]; // up to 3, oldest → newest
  compact?: boolean;       // smaller layout for grid; defaults false (tall)
}

/**
 * Big premium tile for a starred market (Gali, Disawar, Faridabad, Ghaziabad).
 * Shows status, today's open · jodi · close, and a Play CTA.
 */
export function StarMarketTile({ market, result, recentJodis = [], compact }: Props) {
  const declared = result?.status === "DECLARED";
  const open =
    result?.openPana && result?.openDigit !== undefined
      ? `${result.openPana}-${result.openDigit}`
      : "★★★-★";
  const close =
    result?.closePana && result?.closeDigit !== undefined
      ? `${result.closeDigit}-${result.closePana}`
      : "★-★★★";
  const jodi = result?.jodi ?? "★★";

  const status: "OPEN" | "CLOSED" | "DECLARED" = declared
    ? "DECLARED"
    : market.isOpen
      ? "OPEN"
      : "CLOSED";

  const statusClass =
    status === "OPEN"
      ? "bg-success/15 text-success border-success/40"
      : status === "DECLARED"
        ? "bg-primary/15 text-primary border-primary/40"
        : "bg-muted/30 text-muted-foreground border-border";

  return (
    <div
      className={`relative group rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card via-card to-surface p-4 sm:p-5 shadow-[0_8px_32px_-12px_color-mix(in_oklab,var(--primary)_45%,transparent)] hover:shadow-[0_12px_40px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-shadow ${
        compact ? "" : "min-h-[220px]"
      }`}
    >
      {/* gold ribbon */}
      <span className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full bg-gradient-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-background shadow-md">
        <Star className="h-3 w-3 fill-current" /> Star
      </span>

      <div className="flex items-start justify-between gap-2 mt-1">
        <div className="min-w-0">
          <h3 className="font-display text-xl sm:text-2xl font-bold leading-tight truncate">
            {market.displayName}
          </h3>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {market.openTime} · {market.closeTime}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusClass}`}
        >
          {status === "DECLARED" ? "Declared" : status === "OPEN" ? "Open" : "Closed"}
        </span>
      </div>

      {/* Today's number — big and centered */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <NumCell label="Open" value={open} dim={!result?.openPana} />
        <NumCell label="Jodi" value={jodi} highlight dim={!result?.jodi} />
        <NumCell label="Close" value={close} dim={!result?.closePana} />
      </div>

      {/* Last 3 jodis strip */}
      {recentJodis.length > 0 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
            Last 3
          </span>
          {recentJodis.slice(-3).map((j, i, arr) => (
            <span
              key={`${j}-${i}`}
              className={`font-mono text-xs px-1.5 py-0.5 rounded bg-surface/80 border border-border/60 ${
                i === arr.length - 1 ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {j}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="mt-4">
        {market.isOpen ? (
          <Link
            to="/bet/$marketId"
            params={{ marketId: market.id }}
            preload="intent"
            className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-gradient-gold text-background font-bold text-sm py-3 hover:opacity-95 active:scale-[0.98] transition"
          >
            Play Now <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            to="/jodi/$marketId"
            params={{ marketId: market.id }}
            preload="intent"
            className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-primary/40 text-primary font-semibold text-sm py-3 hover:bg-primary/10 transition"
          >
            View Result <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

function NumCell({
  label,
  value,
  highlight,
  dim,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="rounded-lg bg-background/40 border border-border/50 py-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div
        className={`font-mono font-bold ${highlight ? "text-2xl sm:text-3xl text-primary" : "text-base sm:text-lg"} ${
          dim ? "opacity-50" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
