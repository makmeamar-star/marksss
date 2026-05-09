import { AnimatePresence, motion } from "framer-motion";
import { Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  amount: number | null;
  onClose: () => void;
}

export function WinCelebration({ amount, onClose }: Props) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!amount) return;
    setCount(0);
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setCount(Math.round(amount * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [amount]);

  return (
    <AnimatePresence>
      {amount != null && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* confetti */}
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-2 w-2 rounded-sm"
              style={{
                background: i % 2 ? "hsl(var(--primary, 45 100% 60%))" : "#fff",
                left: "50%",
                top: "50%",
              }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{
                x: (Math.random() - 0.5) * 600,
                y: (Math.random() - 0.5) * 600,
                opacity: 0,
                rotate: Math.random() * 720,
              }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="relative glass-gold rounded-2xl p-8 text-center max-w-sm w-full mx-4"
          >
            <button
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="grid h-16 w-16 mx-auto place-items-center rounded-full bg-gradient-gold text-background mb-4">
              <Trophy className="h-8 w-8" />
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">You Won</div>
            <div className="font-display text-5xl font-bold text-primary text-glow-gold mt-2">
              ₹{count.toLocaleString("en-IN")}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Winnings credited to your wallet.
            </p>
            <Button className="mt-5 w-full bg-gradient-gold text-background" onClick={onClose}>
              Awesome
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
