import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResultCard } from "@/components/ResultCard";
import { useMarkets, useResultsForDate } from "@/hooks/useGameData";
import { useEnsureFreshResults } from "@/hooks/useEnsureFreshResults";
import { todayIST } from "@/lib/marketTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { splitTopMarkets } from "@/lib/topMarkets";

const STORAGE_KEY = "markets_show_all";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  status: fallback(z.enum(["all", "open", "closed"]), "all").default("all"),
});

export const Route = createFileRoute("/markets")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Markets — SattaKing Pro" },
      { name: "description", content: "All active Matka markets with timings, status and live results." },
    ],
  }),
  component: MarketsPage,
});

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function MarketsPage() {
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  useEnsureFreshResults();

  const { q, status } = Route.useSearch();
  const navigate = useNavigate({ from: "/markets" });

  // Local input mirror for instant typing; sync to URL on change.
  const [qInput, setQInput] = useState(q);
  useEffect(() => setQInput(q), [q]);

  // Debounce URL writes so each keystroke doesn't push history entries.
  useEffect(() => {
    if (qInput === q) return;
    const t = window.setTimeout(() => {
      navigate({
        search: (prev) => ({ ...prev, q: qInput }),
        replace: true,
      });
    }, 120);
    return () => window.clearTimeout(t);
  }, [qInput, q, navigate]);

  const setStatus = (next: "all" | "open" | "closed") => {
    navigate({ search: (prev) => ({ ...prev, status: next }), replace: true });
  };

  // Filtered list: by status, then by query (matches name + displayName).
  const filtered = useMemo(() => {
    const needle = normalize(qInput);
    return markets.filter((m) => {
      if (status === "open" && !m.isOpen) return false;
      if (status === "closed" && m.isOpen) return false;
      if (!needle) return true;
      const hay = `${normalize(m.displayName ?? "")} ${normalize(m.name ?? "")}`;
      return hay.includes(needle);
    });
  }, [markets, qInput, status]);

  const isFiltering = qInput.trim().length > 0 || status !== "all";
  const { top, rest } = useMemo(() => splitTopMarkets(filtered), [filtered]);

  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpen(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, val ? "1" : "0");
    }
  };

  const renderCard = (m: typeof markets[number]) => (
    <div key={m.id} className="space-y-2">
      <ResultCard market={m} result={results.find((r) => r.marketId === m.id && r.sessionDate === today)} />
      <Button asChild className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
        <Link to="/bet/$marketId" params={{ marketId: m.id }} preload="intent">Bet Now</Link>
      </Button>
    </div>
  );

  const statusBtn = (key: "all" | "open" | "closed", label: string) => (
    <button
      key={key}
      onClick={() => setStatus(key)}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        status === key
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container mx-auto px-4 py-10">
        <h1 className="font-display text-4xl font-bold">Markets</h1>
        <p className="text-muted-foreground mt-1 mb-6">
          Pick a market to view bet types and place your stake.
        </p>

        {/* Search + filter bar */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Search markets… (e.g. Kalyan, Milan, Rajdhani)"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="pl-9 pr-9 h-11"
              aria-label="Search markets"
            />
            {qInput && (
              <button
                type="button"
                onClick={() => setQInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {statusBtn("all", "All")}
            {statusBtn("open", "Open now")}
            {statusBtn("closed", "Closed")}
          </div>
        </div>

        {/* Result count when filtering */}
        {isFiltering && (
          <p className="text-sm text-muted-foreground mb-4">
            {filtered.length} {filtered.length === 1 ? "market" : "markets"} found
          </p>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-border p-10 text-center">
            <p className="text-base font-semibold">No markets match your search</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different name or clear the filter.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setQInput("");
                setStatus("all");
              }}
            >
              Reset filters
            </Button>
          </div>
        )}

        {/* When filtering: flat grid. Otherwise: top + collapsible rest. */}
        {filtered.length > 0 && isFiltering && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(renderCard)}
          </div>
        )}

        {filtered.length > 0 && !isFiltering && (
          <>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-xl font-semibold">
                Top {top.length} <span className="text-muted-foreground font-normal text-sm">· most popular</span>
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {top.map(renderCard)}
            </div>

            {rest.length > 0 && (
              <Collapsible open={open} onOpenChange={handleOpenChange} className="mt-10">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <span>{open ? "Hide" : `Show all ${rest.length} more markets`}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {rest.map(renderCard)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
