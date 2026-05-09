import { motion } from "framer-motion";

interface Props {
  numbers: string[];
  onPick: (n: string) => void;
  selected?: string;
  cols?: number;
}

export function NumberGrid({ numbers, onPick, selected, cols = 10 }: Props) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {numbers.map((n) => {
        const isSel = selected === n;
        return (
          <motion.button
            key={n}
            onClick={() => onPick(n)}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            className={`font-mono py-2 rounded-md border text-sm transition-all
              ${isSel
                ? "bg-primary/20 border-primary text-primary text-glow-gold ring-gold"
                : "border-border bg-surface hover:border-primary/50 hover:text-primary"}`}
          >
            {n}
          </motion.button>
        );
      })}
    </div>
  );
}
