import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, Search, Circle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

import { useDeclareForm } from "@/stores/declareFormStore";
import { useMarketStore } from "@/stores/marketStore";
import { getMarketSessionInfo, pendingToday } from "@/lib/adminApi";
import type { SessionType } from "@/lib/types";

function fmtDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function SessionSelectorCard() {
  const { date, marketId, session, setDate, setMarketId, setSession } = useDeclareForm();
  const markets = useMarketStore((s) => s.markets);
  const results = useMarketStore((s) => s.results);
  const [open, setOpen] = useState(false);

  const declaredMap = useMemo(() => {
    const m = new Map<string, { open: boolean; close: boolean }>();
    for (const r of results) {
      if (r.sessionDate !== date) continue;
      m.set(r.marketId, { open: !!r.openPana, close: !!r.closePana });
    }
    return m;
  }, [results, date]);

  const grouped = useMemo(() => {
    const pending: typeof markets = [];
    const partial: typeof markets = [];
    const declared: typeof markets = [];
    for (const m of markets) {
      const d = declaredMap.get(m.id);
      if (!d) pending.push(m);
      else if (d.open && d.close) declared.push(m);
      else partial.push(m);
    }
    return { pending, partial, declared };
  }, [markets, declaredMap]);

  const selected = markets.find((m) => m.id === marketId) ?? null;

  const { data: info } = useQuery({
    queryKey: ["session-info", marketId, session, date],
    queryFn: () => (marketId ? getMarketSessionInfo(marketId, session, date) : null),
    enabled: !!marketId,
  });

  // Pending count for headline
  const { data: pendingRows = [] } = useQuery({
    queryKey: ["pending-today", "selector"],
    queryFn: pendingToday,
    refetchInterval: 60_000,
  });

  return (
    <div className="rounded-2xl bg-card border border-border/60 border-t-2 border-t-primary p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-primary">Step 1</div>
          <h2 className="font-display text-xl font-bold">Select Market &amp; Session</h2>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {pendingRows.length} pending
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal h-11",
                !date && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
              {date ? format(new Date(date + "T00:00:00"), "dd/MM/yyyy") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date ? new Date(date + "T00:00:00") : undefined}
              onSelect={(d) => d && setDate(fmtDateInput(d))}
              disabled={(d) => d > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {/* Session toggle */}
        <div className="grid grid-cols-2 rounded-md bg-card border border-border/60 p-1 h-11">
          {(["OPEN", "CLOSE"] as SessionType[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSession(s)}
              className={cn(
                "rounded-sm font-display font-bold tracking-wider text-sm transition-all",
                session === s
                  ? "bg-gradient-gold text-background shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Market selector */}
      <div className="mt-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between h-11 font-normal"
            >
              <span className="flex items-center gap-2 truncate">
                {selected ? (
                  <>
                    <StatusDot market={selected} declaredMap={declaredMap} />
                    <span className="font-semibold">{selected.displayName}</span>
                    <span className="text-muted-foreground text-xs hidden sm:inline">
                      | Open {selected.openTime} | Close {selected.closeTime} | Result {selected.resultTime}
                    </span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">-- Choose a market --</span>
                  </>
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search markets..." />
              <CommandList>
                <CommandEmpty>No markets found.</CommandEmpty>
                {grouped.pending.length > 0 && (
                  <CommandGroup heading="PENDING RESULTS">
                    {grouped.pending.map((m) => (
                      <MarketRow key={m.id} m={m} declaredMap={declaredMap}
                        onPick={() => { setMarketId(m.id); setOpen(false); }} />
                    ))}
                  </CommandGroup>
                )}
                {grouped.partial.length > 0 && (
                  <CommandGroup heading="PARTIALLY DECLARED">
                    {grouped.partial.map((m) => (
                      <MarketRow key={m.id} m={m} declaredMap={declaredMap}
                        onPick={() => { setMarketId(m.id); setOpen(false); }} />
                    ))}
                  </CommandGroup>
                )}
                {grouped.declared.length > 0 && (
                  <CommandGroup heading="ALREADY DECLARED">
                    {grouped.declared.map((m) => (
                      <MarketRow key={m.id} m={m} declaredMap={declaredMap}
                        onPick={() => { setMarketId(m.id); setOpen(false); }} />
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Info bar */}
      {selected && info && (
        <div className="mt-4 rounded-lg border border-primary/25 bg-card/70 p-3 text-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <span>📅</span>
            <span className="font-display font-bold">
              {selected.displayName} — {session} Session — {format(new Date(date + "T00:00:00"), "dd MMM yyyy")}
            </span>
          </div>
          <div className="text-muted-foreground text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>⏰ Opened {selected.openTime} · Closed {selected.closeTime}</span>
            <span>🎯 Result expected {session === "OPEN" ? selected.openTime : selected.resultTime}</span>
          </div>
          <div className="text-muted-foreground text-xs flex flex-wrap items-center gap-x-4">
            <span>💰 {info.totalBets} bets · ₹{info.totalBetAmount.toLocaleString("en-IN")} at stake</span>
            <span>
              {info.declared
                ? <span className="text-success">✅ Already declared (Pana {info.pana}, Digit {info.digit})</span>
                : <span className="text-primary">✅ Awaiting declaration</span>}
            </span>
          </div>
          {selected.status === "SUSPENDED" && (
            <div className="flex items-center gap-2 text-destructive text-xs mt-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Market suspended — declaration disabled
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({
  market, declaredMap,
}: { market: { id: string; status: string }; declaredMap: Map<string, { open: boolean; close: boolean }> }) {
  const d = declaredMap.get(market.id);
  let cls = "text-success"; // pending = green dot in spec
  if (market.status === "SUSPENDED") cls = "text-destructive";
  else if (d?.open && d?.close) cls = "text-muted-foreground";
  else if (d?.open || d?.close) cls = "text-primary";
  return <Circle className={cn("h-2.5 w-2.5 fill-current", cls)} />;
}

function MarketRow({
  m, declaredMap, onPick,
}: {
  m: { id: string; displayName: string; openTime: string; closeTime: string; resultTime: string; status: string };
  declaredMap: Map<string, { open: boolean; close: boolean }>;
  onPick: () => void;
}) {
  return (
    <CommandItem onSelect={onPick} className="gap-2">
      <StatusDot market={m} declaredMap={declaredMap} />
      <span className="font-semibold">{m.displayName}</span>
      <span className="ml-auto text-xs text-muted-foreground font-mono">
        {m.openTime} · {m.closeTime} · {m.resultTime}
      </span>
    </CommandItem>
  );
}

// Re-export for tree-shaking helpers used elsewhere
export { useEffect };
