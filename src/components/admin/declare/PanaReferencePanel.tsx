import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDeclareForm } from "@/stores/declareFormStore";
import { getPanasForDigit, isValidPana } from "@/lib/panaChart";
import { cn } from "@/lib/utils";

export function PanaReferencePanel() {
  const { pana, setPana } = useDeclareForm();
  const matched = pana.length === 3 && isValidPana(pana);
  const matchedDigit = matched ? Number(pana.split("").reduce((s, c) => s + Number(c), 0)) % 10 : null;
  const [activeDigit, setActiveDigit] = useState<number>(matchedDigit ?? 6);
  const [search, setSearch] = useState("");

  // sync with live input
  const effectiveDigit = matchedDigit ?? activeDigit;
  const groups = useMemo(() => getPanasForDigit(effectiveDigit), [effectiveDigit]);

  const filter = (list: string[]) =>
    search ? list.filter((p) => p.includes(search)) : list;

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4">
      <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-3">Pana Chart Reference</h3>

      <div className="grid grid-cols-10 gap-1 mb-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveDigit(i)}
            className={cn(
              "h-8 rounded-md text-sm font-mono transition-colors border",
              effectiveDigit === i
                ? "bg-primary text-background border-primary"
                : "bg-card border-border text-muted-foreground hover:bg-muted/40",
            )}
          >
            {i}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search pana..."
          value={search}
          onChange={(e) => setSearch(e.target.value.replace(/\D/g, "").slice(0, 3))}
          className="h-8 pl-7 text-xs"
        />
      </div>

      <div className="text-[10px] uppercase tracking-widest text-primary mb-2">Digit {effectiveDigit}</div>

      {(["single", "double", "triple"] as const).map((kind) => {
        const list = filter(groups[kind]);
        return (
          <div key={kind} className="mb-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              {kind === "single" ? "SP (Single)" : kind === "double" ? "DP (Double)" : "TP (Triple)"}
            </div>
            {list.length === 0 ? (
              <div className="text-xs text-muted-foreground/60">—</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {list.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPana(p)}
                    className={cn(
                      "px-1.5 py-0.5 rounded font-mono text-xs border transition-colors",
                      p === pana
                        ? "bg-primary/30 border-primary text-primary"
                        : "border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/40",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
