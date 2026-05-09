import { motion } from "framer-motion";

export function JodiCalculation({
  openDigit, closeDigit,
}: { openDigit: number; closeDigit: number }) {
  const jodi = `${openDigit}${closeDigit}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 rounded-xl glass-gold p-4"
    >
      <div className="text-[10px] uppercase tracking-[0.25em] text-primary mb-3">Jodi Calculation</div>
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        <Cell value={openDigit} caption="OPEN" />
        <span className="text-xl font-display text-muted-foreground">+</span>
        <Cell value={closeDigit} caption="CLOSE" />
        <span className="text-xl font-display text-muted-foreground">=</span>
        <Cell value={jodi} caption="JODI" highlight />
      </div>
    </motion.div>
  );
}

function Cell({ value, caption, highlight = false }: { value: number | string; caption: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`grid h-12 min-w-12 px-3 place-items-center rounded-lg font-mono text-2xl font-bold border-2
          ${highlight ? "bg-primary/15 border-primary text-primary text-glow-gold" : "bg-card border-border text-foreground"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">{caption}</div>
    </div>
  );
}
