import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useBetStore } from "@/stores/betStore";
import { useAuthStore } from "@/stores/authStore";

function SlipBody({ onClose }: { onClose?: () => void }) {
  const slip = useBetStore((s) => s.slip);
  const remove = useBetStore((s) => s.removeFromSlip);
  const clear = useBetStore((s) => s.clearSlip);
  const placeAll = useBetStore((s) => s.placeAll);
  const balance = useAuthStore((s) => s.user?.balance ?? 0);

  const total = slip.reduce((s, x) => s + x.amount, 0);
  const potential = slip.reduce((s, x) => s + x.amount * x.payout, 0);

  const submit = () => {
    const r = placeAll();
    if (!r.ok) toast.error(r.error ?? "Could not place bets");
    else {
      toast.success(`Placed ${r.placed} bet${r.placed > 1 ? "s" : ""} successfully`);
      onClose?.();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Bet Slip</h3>
          <p className="text-xs text-muted-foreground">{slip.length} selection{slip.length !== 1 && "s"}</p>
        </div>
        {slip.length > 0 && (
          <button onClick={clear} className="text-xs text-muted-foreground hover:text-danger">Clear all</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {slip.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            Your bet slip is empty. Pick a number to add bets.
          </div>
        )}
        {slip.map((b) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-lg p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{b.marketName} · {b.session}</div>
                <div className="font-display text-sm font-semibold truncate">{b.betType}</div>
                <div className="font-mono text-primary text-lg text-glow-gold mt-0.5">{b.betNumber}</div>
              </div>
              <button onClick={() => remove(b.id)} className="text-muted-foreground hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-muted-foreground">Stake</span>
              <span className="font-mono">₹{b.amount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Potential win</span>
              <span className="font-mono text-success">₹{(b.amount * b.payout).toLocaleString("en-IN")}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="border-t border-border/60 p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total stake</span>
          <span className="font-mono font-semibold">₹{total.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Potential win</span>
          <span className="font-mono font-semibold text-success">₹{potential.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Balance</span>
          <span className="font-mono">₹{balance.toLocaleString("en-IN")}</span>
        </div>
        <Button
          onClick={submit}
          disabled={slip.length === 0 || total > balance}
          className="w-full bg-gradient-gold text-background font-bold hover:opacity-90"
        >
          {total > balance ? "Insufficient balance" : `Place ${slip.length || ""} bet${slip.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

export function BetSlipDesktop() {
  return (
    <aside className="hidden xl:flex sticky top-6 h-[calc(100vh-3rem)] w-80 shrink-0 glass-gold rounded-xl overflow-hidden">
      <SlipBody />
    </aside>
  );
}

export function BetSlipMobile() {
  const slip = useBetStore((s) => s.slip);
  const total = slip.reduce((s, x) => s + x.amount, 0);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="xl:hidden fixed bottom-20 inset-x-4 z-30 bg-gradient-gold text-background font-bold py-3 rounded-xl shadow-[0_0_30px_-8px_var(--primary)] flex items-center justify-between px-5">
          <span>Bet Slip ({slip.length})</span>
          <span className="font-mono">₹{total.toLocaleString("en-IN")}</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] bg-card border-border/60 p-0">
        <SlipBody onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
