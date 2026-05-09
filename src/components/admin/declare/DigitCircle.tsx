import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

export function DigitCircle({ digit, label = "OPEN DIGIT" }: { digit: number; label?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(mv, digit, { duration: 0.7, ease: [0.25, 1, 0.5, 1] });
    return controls.stop;
  }, [digit, mv]);

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
      className="flex flex-col items-center"
    >
      <div
        className="grid h-28 w-28 place-items-center rounded-full text-background font-display font-bold text-6xl"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 30%, var(--gold-glow), var(--primary-hover))",
          boxShadow:
            "0 0 30px color-mix(in oklab, var(--primary) 50%, transparent), inset 0 -8px 20px rgba(0,0,0,0.25)",
        }}
      >
        <motion.span>{rounded}</motion.span>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </div>
    </motion.div>
  );
}
