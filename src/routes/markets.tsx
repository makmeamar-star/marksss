import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResultCard } from "@/components/ResultCard";
import { StarMarketsSection } from "@/components/StarMarketsSection";
import { isStarMarket } from "@/config/starMarkets";
import { Star } from "lucide-react";
import { useMarkets, useResultsForDate } from "@/hooks/useGameData";
import { useEnsureFreshResults } from "@/hooks/useEnsureFreshResults";
import { todayIST } from "@/lib/marketTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { splitTopMarkets, TOP_MARKET_IDS } from "@/lib/topMarkets";

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

function highlightMatch(label: string, query: string) {
  const q = query.trim();
  if (!q) return label;
  const idx = label.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return label;
  return (
    <>
      {label.slice(0, idx)}
      <mark className="bg-transparent text-primary font-semibold">
        {label.slice(idx, idx + q.length)}
      </mark>
      {label.slice(idx + q.length)}
    </>
  );
}

function MarketsPage() {
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  useEnsureFreshResults();

  // Prefetch top-15 detail pages (bet + jodi) once markets are loaded so
  // tapping a card opens instantly — and the route chunks are cached by the
  // service worker for offline use. Runs idle to avoid contending with paint.
  const router = useRouter();
  const knownIds = useMemo(() => new Set(markets.map((m) => m.id)), [markets]);
  useEffect(() => {
    if (markets.length === 0) return;
    const ids = TOP_MARKET_IDS.filter((id) => knownIds.has(id));
    if (ids.length === 0) return;
    const run = () => {
      for (const marketId of ids) {
        router.preloadRoute({ to: "/bet/$marketId", params: { marketId } }).catch(() => {});
        router.preloadRoute({ to: "/jodi/$marketId", params: { marketId } }).catch(() => {});
      }
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const handle = ric ? ric(run, { timeout: 1500 }) : window.setTimeout(run, 300);
    return () => {
      if (ric && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(handle);
      else window.clearTimeout(handle as number);
    };
  }, [router, knownIds, markets.length]);

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
        search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, q: qInput }),
        replace: true,
      });
    }, 120);
    return () => window.clearTimeout(t);
  }, [qInput, q, navigate]);

  const setStatus = (next: "all" | "open" | "closed") => {
    navigate({
      search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, status: next }),
      replace: true,
    });
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

  // ---- Autocomplete suggestions for the search box ----
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const suggestions = useMemo(() => {
    const needle = normalize(qInput);
    if (!needle) return [];
    const scored: Array<{ m: typeof markets[number]; score: number }> = [];
    for (const m of markets) {
      const display = normalize(m.displayName ?? "");
      const name = normalize(m.name ?? "");
      let score = -1;
      if (display.startsWith(needle) || name.startsWith(needle)) score = 0;
      else if (display.includes(needle) || name.includes(needle)) score = 1;
      if (score >= 0) scored.push({ m, score });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 8).map((s) => s.m);
  }, [markets, qInput]);

  // Reset highlight when the suggestion list changes.
  useEffect(() => {
    setActiveSuggestion(-1);
  }, [qInput, suggestions.length]);

  const pickSuggestion = (m: typeof markets[number]) => {
    const label = m.displayName ?? m.name ?? "";
    setQInput(label);
    setSuggestOpen(false);
    setActiveSuggestion(-1);
  };

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

  const renderCard = (m: typeof markets[number]) => {
    const star = isStarMarket(m.id);
    return (
      <div
        key={m.id}
        className={`space-y-1.5 relative ${
          star ? "rounded-lg ring-1 ring-primary/40 p-1" : ""
        }`}
      >
        {star && (
          <span className="absolute -top-1.5 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-gold px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-background shadow">
            <Star className="h-2.5 w-2.5 fill-current" /> Star
          </span>
        )}
        <ResultCard market={m} result={results.find((r) => r.marketId === m.id && r.sessionDate === today)} />
        <Button asChild size="sm" className="w-full h-8 text-xs bg-gradient-gold text-background font-bold hover:opacity-90">
          <Link to="/bet/$marketId" params={{ marketId: m.id }} preload="intent">Bet Now</Link>
        </Button>
      </div>
    );
  };

  const statusBtn = (key: "all" | "open" | "closed", label: string) => (
    <button
      key={key}
      onClick={() => setStatus(key)}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
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

      {/* Sticky Star Markets strip — always visible at top of /markets */}
      <div className="sticky top-12 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2">
          <StarMarketsSection scroll />
        </div>
      </div>

      <section className="container mx-auto px-4 py-6">
        <h1 className="font-display text-2xl font-bold">Markets</h1>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">
          Pick a market to view bet types and place your stake.
        </p>

        {/* Search + filter bar */}
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Search markets… (e.g. Kalyan, Milan, Rajdhani)"
              value={qInput}
              onChange={(e) => {
                setQInput(e.target.value);
                setSuggestOpen(true);
                setActiveSuggestion(-1);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
              onKeyDown={(e) => {
                if (!suggestOpen || suggestions.length === 0) {
                  if (e.key === "ArrowDown") setSuggestOpen(true);
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveSuggestion((i) => (i + 1) % suggestions.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                } else if (e.key === "Enter" && activeSuggestion >= 0) {
                  e.preventDefault();
                  pickSuggestion(suggestions[activeSuggestion]);
                } else if (e.key === "Escape") {
                  setSuggestOpen(false);
                }
              }}
              role="combobox"
              aria-expanded={suggestOpen && suggestions.length > 0}
              aria-controls="markets-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                activeSuggestion >= 0 ? `market-sugg-${suggestions[activeSuggestion]?.id}` : undefined
              }
              className="pl-9 pr-9 h-11"
              aria-label="Search markets"
            />
            {qInput && (
              <button
                type="button"
                onClick={() => setQInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted z-10"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {suggestOpen && suggestions.length > 0 && (
              <ul
                id="markets-suggestions"
                role="listbox"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
              >
                {suggestions.map((m, idx) => {
                  const label = m.displayName ?? m.name ?? m.id;
                  return (
                    <li
                      key={m.id}
                      id={`market-sugg-${m.id}`}
                      role="option"
                      aria-selected={idx === activeSuggestion}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickSuggestion(m);
                      }}
                      onMouseEnter={() => setActiveSuggestion(idx)}
                      className={`flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer ${
                        idx === activeSuggestion
                          ? "bg-primary/10 text-foreground"
                          : "text-foreground/90 hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{highlightMatch(label, qInput)}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wider shrink-0 ${
                          m.isOpen ? "text-emerald-400" : "text-muted-foreground"
                        }`}
                      >
                        {m.isOpen ? "Open" : "Closed"}
                      </span>
                    </li>
                  );
                })}
              </ul>
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
