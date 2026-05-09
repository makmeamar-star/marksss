import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface Props {
  value?: string;     // displayed digits/numbers
  size?: "sm" | "md" | "lg";
  spinOnChange?: boolean;
}

/** Slot-machine style number reveal. Falls back to "--" when empty. */
export function NumberReveal({ value, size = "md", spinOnChange = true }: Props) {
  const [display, setDisplay] = useState(value ?? "");
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (!value || !spinOnChange) {
      setDisplay(value ?? "");
      return;
    }
    if (value === display) return;
    setSpinning(true);
    let i = 0;
    const tick = setInterval(() => {
      const random = value
        .split("")
        .map(() => Math.floor(Math.random() * 10))
        .join("");
      setDisplay(random);
      i++;
      if (i > 8) {
        clearInterval(tick);
        setDisplay(value);
        setSpinning(false);
      }
    }, 70);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sizeCls =
    size === "lg" ? "text-4xl md:text-5xl" :
    size === "sm" ? "text-lg" :
    "text-2xl md:text-3xl";

  if (!display) {
    return <span className={`font-mono font-bold text-muted-foreground ${sizeCls}`}>--</span>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={display + (spinning ? "s" : "f")}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className={`font-mono font-bold tracking-wider ${sizeCls} ${spinning ? "text-primary" : "text-primary text-glow-gold"}`}
      >
        {display}
      </motion.span>
    </AnimatePresence>
  );
}
