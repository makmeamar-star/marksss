import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { isValidPana } from "@/lib/panaChart";
import { adminOverrideResult } from "@/lib/adminOverride.functions";
import { cn } from "@/lib/utils";

export interface HardOverrideRow {
  marketId: string;
  marketName: string;
  session: "OPEN" | "CLOSE";
  sessionDate: string; // YYYY-MM-DD
  pana: string; // current pana
}

interface Props {
  row: HardOverrideRow | null;
  onClose: () => void;
}

export function HardOverrideDialog({ row, onClose }: Props) {
  const [pana, setPana] = useState("");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  if (!row) return null;

  const panaOk = pana.length === 3 && isValidPana(pana) && pana !== row.pana;
  const reasonOk = reason.trim().length >= 20;
  const confirmOk = confirmText.trim().toUpperCase() === "OVERRIDE";
  const canSubmit = panaOk && reasonOk && ack && confirmOk && !busy;

  const reset = () => {
    setPana(""); setReason(""); setAck(false); setConfirmText(""); setBusy(false);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const res = await adminOverrideResult({
        data: {
          marketId: row.marketId,
          sessionDate: row.sessionDate,
          session: row.session,
          newPana: pana,
          reason: reason.trim(),
          confirm: "I_UNDERSTAND_THIS_RESETTLES",
        },
      });
      const r: any = res.result ?? {};
      toast.success(
        `Override applied: ${row.pana} → ${pana}. ${r.winners ?? 0} new winners, ` +
          `delta ₹${Number(r.payoutDelta ?? 0).toFixed(0)}.`,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["declared-today"] }),
        qc.invalidateQueries({ queryKey: ["admin", "history"] }),
        qc.invalidateQueries({ queryKey: ["pending-today"] }),
      ]);
      reset();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Override failed");
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="border-destructive/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Hard override result
          </DialogTitle>
          <DialogDescription>
            <strong>{row.marketName} — {row.session}</strong> · current pana{" "}
            <code className="font-mono">{row.pana}</code> on {row.sessionDate}.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs space-y-1">
          <p className="font-semibold text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> This bypasses the 10-minute correction window.
          </p>
          <ul className="list-disc pl-4 text-destructive/90 space-y-0.5">
            <li>Every settled bet for this session is reversed and re-settled.</li>
            <li>Users who already withdrew winnings may end up with a negative balance.</li>
            <li>A warning is added to system alerts and the audit log.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ovr-pana">New pana (3 digits)</Label>
            <Input
              id="ovr-pana"
              value={pana}
              onChange={(e) => setPana(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className={cn("font-mono text-lg tracking-widest", pana && !panaOk && "border-destructive")}
              placeholder="123"
              disabled={busy}
            />
            {pana && !panaOk && (
              <p className="text-[11px] text-destructive mt-1">
                {pana === row.pana ? "Must differ from current pana." : "Invalid pana."}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="ovr-reason">Reason (min 20 chars)</Label>
            <Textarea
              id="ovr-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Operator declared wrong pana — confirmed by source feed at 14:32; rolling back to correct value."
              rows={3}
              disabled={busy}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {reason.trim().length}/20
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(!!v)} disabled={busy} />
            <span>
              I understand this re-settles all bets and may produce negative balances for users
              who already cashed out.
            </span>
          </label>

          <div>
            <Label htmlFor="ovr-confirm">Type <code className="font-mono">OVERRIDE</code> to confirm</Label>
            <Input
              id="ovr-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={cn("font-mono", confirmText && !confirmOk && "border-destructive")}
              disabled={busy}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={busy}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!canSubmit}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
            Hard override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
