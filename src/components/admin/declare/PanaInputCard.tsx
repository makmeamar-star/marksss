import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useDeclareForm } from "@/stores/declareFormStore";
import { useMarketStore } from "@/stores/marketStore";
import {
  PANA_CHART, PANA_TYPE_BADGE, isValidPana, digitFromPana, panaType,
} from "@/lib/panaChart";
import { validatePana } from "@/lib/adminApi";
import { DigitCircle } from "./DigitCircle";
import { JodiCalculation } from "./JodiCalculation";

export function PanaInputCard() {
  const { pana, setPana, marketId, session, date } = useDeclareForm();
  const [mode, setMode] = useState<"boxes" | "single">("boxes");

  const valid = pana.length === 3 && isValidPana(pana);
  const digit = pana.length === 3 ? digitFromPana(pana) : null;

  const { data: validation } = useQuery({
    queryKey: ["validate-pana", pana],
    queryFn: () => validatePana(pana),
    enabled: pana.length === 3,
  });

  const market = useMarketStore((s) => s.markets.find((m) => m.id === marketId));
  const existing = useMarketStore((s) =>
    s.results.find((r) => r.marketId === marketId && r.sessionDate === date),
  );

  // For jodi: show only when both digits exist (one from existing, one from current)
  const otherDigit = session === "OPEN" ? existing?.closeDigit : existing?.openDigit;
  const showJodi = valid && otherDigit !== undefined && digit !== null;
  const jodiOpen = session === "OPEN" ? digit! : otherDigit!;
  const jodiClose = session === "CLOSE" ? digit! : otherDigit!;

  const inlineRefs = useMemo(
    () => (digit !== null ? PANA_CHART[digit] : []),
    [digit],
  );

  const disabled = !marketId || (market?.status === "SUSPENDED");

  return (
    <div
      id="pana-input-card"
      className={cn(
        "rounded-2xl bg-card border border-border/60 border-t-2 p-5 transition-colors",
        valid ? "border-t-success" : pana.length === 3 ? "border-t-destructive" : "border-t-primary",
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-primary">Step 2</div>
          <h2 className="font-display text-xl font-bold">Enter Pana Number</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={mode === "boxes" ? "default" : "outline"}
            onClick={() => setMode("boxes")}
            className="h-7 px-2 text-xs"
          >Boxes</Button>
          <Button
            size="sm"
            variant={mode === "single" ? "default" : "outline"}
            onClick={() => setMode("single")}
            className="h-7 px-2 text-xs"
          >Single</Button>
        </div>
      </div>

      {disabled && (
        <div className="mb-4 rounded-md bg-muted/30 border border-border/60 p-3 text-sm text-muted-foreground text-center">
          {market?.status === "SUSPENDED"
            ? "Market is suspended — cannot declare result."
            : "Select a market and session above to begin."}
        </div>
      )}

      <div className={cn("flex flex-col items-center", disabled && "opacity-40 pointer-events-none")}>
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">
          {session === "OPEN" ? "ENTER OPEN PANA" : "ENTER CLOSE PANA"}
        </div>

        {mode === "boxes" ? (
          <DigitBoxes pana={pana} setPana={setPana} valid={valid} invalid={pana.length === 3 && !valid} />
        ) : (
          <SingleField pana={pana} setPana={setPana} valid={valid} invalid={pana.length === 3 && !valid} />
        )}

        <div className="mt-3 text-sm text-muted-foreground font-mono tracking-widest min-h-5">
          {pana.length > 0 && `Pana: ${pana.split("").join("  ")}`}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {pana.length === 3 && validation && (
          <motion.div
            key={validation.valid ? "valid" : "invalid"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-5"
          >
            {validation.valid ? (
              <ValidBlock pana={pana} digit={validation.digit!} type={validation.type!} />
            ) : (
              <InvalidBlock
                pana={pana}
                suggestions={validation.suggestions}
                digit={validation.digit ?? 0}
                onPick={(p) => setPana(p)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline reference */}
      {digit !== null && (
        <div className="mt-4 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-xs">
          <span className="text-muted-foreground mr-2 uppercase tracking-wider">Valid panas for digit {digit}:</span>
          <span className="font-mono">
            {inlineRefs.map((p, i) => (
              <span key={p}>
                <span
                  className={cn(
                    "px-1",
                    p === pana && "bg-primary/20 text-primary rounded",
                  )}
                >
                  {p}
                </span>
                {i < inlineRefs.length - 1 && <span className="text-border">|</span>}
              </span>
            ))}
          </span>
        </div>
      )}

      {showJodi && <JodiCalculation openDigit={jodiOpen} closeDigit={jodiClose} />}
    </div>
  );
}

function DigitBoxes({
  pana, setPana, valid, invalid,
}: { pana: string; setPana: (p: string) => void; valid: boolean; invalid: boolean }) {
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const digits = ["0", "1", "2"].map((_, i) => pana[i] ?? "");

  // Focus first empty box when pana changes externally
  useEffect(() => {
    const firstEmpty = digits.findIndex((d) => d === "");
    const idx = firstEmpty === -1 ? 2 : firstEmpty;
    refs[idx]?.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (i: number, v: string) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    const arr = digits.slice();
    arr[i] = ch;
    setPana(arr.join(""));
    if (ch && i < 2) refs[i + 1]?.current?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs[i - 1]?.current?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs[i - 1]?.current?.focus();
    if (e.key === "ArrowRight" && i < 2) refs[i + 1]?.current?.focus();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 3);
    if (!txt) return;
    e.preventDefault();
    setPana(txt);
    refs[Math.min(txt.length, 2)]?.current?.focus();
  };

  return (
    <div className="flex items-center justify-center gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col items-center">
          <input
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i]}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            tabIndex={i === 0 ? 1 : 2 + i}
            className={cn(
              "h-20 w-20 rounded-lg bg-background text-center font-mono text-4xl font-bold",
              "border-2 transition-colors outline-none",
              "focus:ring-2 focus:ring-primary/40",
              valid ? "border-success" : invalid ? "border-destructive" : "border-border focus:border-primary",
            )}
          />
          <span className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">Digit {i + 1}</span>
        </div>
      ))}
    </div>
  );
}

function SingleField({
  pana, setPana, valid, invalid,
}: { pana: string; setPana: (p: string) => void; valid: boolean; invalid: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <input
        type="text"
        inputMode="numeric"
        maxLength={3}
        value={pana.split("").join(" ")}
        onChange={(e) => setPana(e.target.value)}
        placeholder="0 0 0"
        className={cn(
          "h-20 w-64 rounded-lg bg-background text-center font-mono text-4xl font-bold tracking-[0.4em] text-primary text-glow-gold",
          "border-2 transition-colors outline-none focus:ring-2 focus:ring-primary/40",
          valid ? "border-success" : invalid ? "border-destructive" : "border-border focus:border-primary",
        )}
      />
    </div>
  );
}

function ValidBlock({ pana, digit, type }: { pana: string; digit: number; type: keyof typeof PANA_TYPE_BADGE }) {
  const sumLine = `${pana[0]} + ${pana[1]} + ${pana[2]} = ${pana.split("").reduce((s, c) => s + Number(c), 0)} → Last digit = ${digit}`;
  const badge = PANA_TYPE_BADGE[type];
  return (
    <div className="rounded-xl border border-success/30 bg-success/10 p-4">
      <div className="flex items-center gap-2 text-success font-bold">
        <Check className="h-4 w-4" /> Pana {pana} is VALID
        <Badge variant="outline" className={cn("ml-2 font-display", badge.className)}>
          {badge.label} · {type}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-4">
        <div className="text-sm text-muted-foreground">
          <div className="text-[10px] uppercase tracking-widest text-success/80">Digit Calculation</div>
          <div className="font-mono text-foreground">{sumLine}</div>
        </div>
        <DigitCircle digit={digit} label={panaTypeLabel(type)} />
      </div>
    </div>
  );
}

function panaTypeLabel(t: string): string {
  return t === "TRIPLE" ? "TRIPLE PANA" : t === "DOUBLE" ? "DOUBLE PANA" : "RESULT DIGIT";
}

function InvalidBlock({
  pana, suggestions, digit, onPick,
}: { pana: string; suggestions: string[]; digit: number; onPick: (p: string) => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
      <div className="flex items-center gap-2 text-destructive font-bold">
        <X className="h-4 w-4" /> Pana {pana} is NOT a valid Matka pana
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        {pana} does not appear in the official pana chart for digit {digit}
        {panaType(pana) !== "SINGLE" ? ` (${panaType(pana).toLowerCase()})` : ""}.
      </div>
      {suggestions.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Did you mean?</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onPick(s)}
                className="rounded-md border border-primary/40 bg-primary/10 text-primary px-2.5 py-1 text-sm font-mono hover:bg-primary/20 transition"
              >
                <Hash className="inline h-3 w-3 mr-1" />{s} (digit {digitFromPana(s)})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
