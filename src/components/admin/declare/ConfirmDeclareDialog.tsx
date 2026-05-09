import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Check } from "lucide-react";
import { format } from "date-fns";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useDeclareForm } from "@/stores/declareFormStore";
import { useMarketStore } from "@/stores/marketStore";
import { useBetStore } from "@/stores/betStore";
import { digitFromPana, panaType } from "@/lib/panaChart";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (confirmationText: string) => Promise<unknown> | void;
  busy: boolean;
}

export function ConfirmDeclareDialog({ open, onOpenChange, onConfirm, busy }: Props) {
  const { marketId, session, date, pana } = useDeclareForm();
  const market = useMarketStore((s) => s.markets.find((m) => m.id === marketId));
  const bets = useBetStore((s) =>
    s.bets.filter((b) => b.marketId === marketId && b.sessionDate === date && b.session === session),
  );
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  if (!market) return null;
  const digit = digitFromPana(pana);

  async function submit() {
    await onConfirm(text);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-primary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Confirm Result Declaration
          </DialogTitle>
          <DialogDescription>
            You are about to declare the following result. This action cannot be undone after 10 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm space-y-1">
          <Row label="Market" value={market.displayName} />
          <Row label="Session" value={session} />
          <Row label="Date" value={format(new Date(date + "T00:00:00"), "dd MMM yyyy")} />
          <Row label="Pana" value={pana.split("").join(" — ")} mono />
          <Row label="Digit" value={String(digit)} mono />
          <Row label="Pana Type" value={panaTypeLabel(pana)} />
        </div>

        <div className="rounded-md bg-muted/30 border border-border/60 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
          <div>• {bets.length} bets will be evaluated</div>
          <div>• Winning bets will be credited automatically</div>
          <div>• Affected users will be notified</div>
        </div>

        <div>
          <Label htmlFor="confirm-input" className="text-xs">
            Type <span className="font-mono text-primary">CONFIRM</span> to proceed:
          </Label>
          <Input
            id="confirm-input"
            value={text}
            onChange={(e) => setText(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter" && text === "CONFIRM" && !busy) submit(); }}
            placeholder="CONFIRM"
            className="font-mono mt-1"
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={text !== "CONFIRM" || busy}
            className="bg-gradient-gold text-background"
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            {busy ? "Declaring…" : "Declare Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-primary" : "font-semibold"}>{value}</span>
    </div>
  );
}

function panaTypeLabel(p: string): string {
  if (p.length !== 3) return "—";
  const t = panaType(p);
  return t === "TRIPLE" ? "Triple Pana" : t === "DOUBLE" ? "Double Pana" : "Single Pana";
}
