import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useRealtimeStore } from "@/stores/realtimeStore";
import { useEffect, useState } from "react";

export function ActivityFeedPanel() {
  const events = useRealtimeStore((s) => s.events).slice(0, 10);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm uppercase tracking-wider pulse-live">Live Activity</h3>
      </div>
      {events.length === 0 ? (
        <div className="text-xs text-muted-foreground p-4 text-center">
          No activity yet — declare a result to see live updates.
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {events.map((e) => (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0 }}
                className="rounded-md bg-card/50 border border-border/40 px-2.5 py-1.5 text-xs"
              >
                <div className="text-foreground">{e.message}</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {formatDistanceToNow(new Date(e.ts), { addSuffix: true })}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
