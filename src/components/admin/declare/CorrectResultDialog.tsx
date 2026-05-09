import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

import { isValidPana, digitFromPana } from "@/lib/panaChart";
import { correctResult, type DeclaredMarketRow } from "@/lib/adminApi";
import { cn } from "@/lib/utils";

interface Props {
  row: DeclaredMarketRow | null;
  onClose: () => void;
}

const WINDOW_MS = 10 * 60 * 1000;

export function CorrectResultDialog({ row, onClose }: Props) {
  const [pana, setPana] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const qc = useQueryClient();

  useEffect(() => {
    if (!row) return;
    setPana("");
    setReason("");
    const tick = () => {
      const elapsed = Date.now() - new Date(row.declaredAt).getTime();
      setRemaining(Math.max(0, WINDOW_MS - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [row]);

  if (!row) return null;

  const valid = pana.length === 3 && isValidPana(pana);
  const reasonOk = reason.trim().length >= 10;
  const canSubmit = valid && reasonOk && remaining > 0 && !busy;

  async function submit() {
    if (!row) return;
    setBusy(true);
    const res = await correctResult({
      marketId: row.marketId,
      sessionDate: new Date(row.declaredAt).toISOString().slice(0, 10),
      session: row.session,
      newPana: pana,
      reason,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Corrected: ${res.oldPana} → ${res.newPana}`, {
      description: `${res.settledBets} bets re-evaluated.`,
    });
    qc.invalidateQueries();
    onClose();
  }

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg border-primary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <RotateCw className="h-5 w-5 text-primary" />
            Result Correction — {row.marketName} {row.session}
          </DialogTitle>
          <DialogDescription>
            Reverses the prior settlement and re-runs with the new pana.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current</span>
            <span className="font-mono text-primary">Pana {row.pana} · Digit {row.digit}</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Correction window</span>
              <span className="font-mono">{minutes}m {seconds}s remaining</span>
            </div>
            <Progress value={(remaining / WINDOW_MS) * 100} className="h-1.5" />
          </div>
        </div>

        <div>
          <Label className="text-xs">New pana</Label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={pana}
            onChange={(e) => setPana(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="000"
            className={cn(
              "mt-1 h-12 w-full rounded-md bg-background border-2 px-3 font-mono text-2xl tracking-widest text-center",
              valid ? "border-success" : pana.length === 3 ? "border-destructive" : "border-border focus:border-primary",
              "outline-none transition-colors",
            )}
          />
          {valid && (
            <div className="mt-1 text-xs text-success">
              Valid · digit {digitFromPana(pana)}
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs">Reason for correction (required)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Typo — entered 123 instead of 132"
            className="mt-1 min-h-20"
          />
          <div className="mt-1 text-[10px] text-muted-foreground">
            {reason.trim().length}/10 minimum characters
          </div>
        </div>

        <div className="rounded-md bg-warning/5 border border-primary/30 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
          <div>• Reverses all wallet credits for this session</div>
          <div>• Re-runs settlement with the new result</div>
          <div>• Notifies all affected users</div>
          <div>• Adds a full audit log entry</div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="bg-gradient-gold text-background"
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCw className="h-4 w-4 mr-2" />}
            Apply Correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
