import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { Target, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDeclareForm } from "@/stores/declareFormStore";
import { useMarketStore } from "@/stores/marketStore";
import { isValidPana } from "@/lib/panaChart";
import { declareResult } from "@/lib/adminApi";
import { adminDeclareResult } from "@/lib/adminDeclare.functions";
import { ConfirmDeclareDialog } from "./ConfirmDeclareDialog";
import { cn } from "@/lib/utils";

export function DeclareButton() {
  const { marketId, session, date, pana, reset } = useDeclareForm();
  const market = useMarketStore((s) => s.markets.find((m) => m.id === marketId));
  const valid = pana.length === 3 && isValidPana(pana);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const declareFn = useServerFn(adminDeclareResult);
  const router = useRouter();

  async function refreshAfterDeclare() {
    // Invalidate every admin/result-related query so observation lists,
    // declared-today, pending-today, missing-results banner, public result
    // cards, etc. all reload from the database immediately.
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin", "today-observations"] }),
      qc.invalidateQueries({ queryKey: ["admin", "missing-results"] }),
      qc.invalidateQueries({ queryKey: ["declared-today"] }),
      qc.invalidateQueries({ queryKey: ["pending-today"] }),
      qc.invalidateQueries({ queryKey: ["pending-today", "selector"] }),
      qc.invalidateQueries({ queryKey: ["session-info"] }),
      qc.invalidateQueries({ queryKey: ["results"] }),
      qc.invalidateQueries({ queryKey: ["market-results"] }),
      qc.invalidateQueries({ queryKey: ["recent-results"] }),
      qc.invalidateQueries(), // catch-all for anything keyed differently
    ]);
    // Re-run route loaders so SSR-fetched data (e.g. results page loaders)
    // refreshes too.
    await router.invalidate();
  }

  const enabled = !!marketId && valid && market?.status !== "SUSPENDED" && !busy;

  async function handleConfirm(confirmationText: string) {
    if (!marketId) return;
    if (confirmationText !== "CONFIRM") {
      toast.error("Type CONFIRM to proceed");
      return { ok: false as const, error: "Type CONFIRM to proceed" };
    }
    setBusy(true);

    // 1) Persist to the database via the admin server function.
    try {
      await declareFn({
        data: { marketId, sessionDate: date, session, value: pana },
      });
    } catch (e: any) {
      setBusy(false);
      const msg = e?.message ?? "Failed to declare result";
      toast.error(msg);
      return { ok: false as const, error: msg };
    }

    // 2) Mirror locally so the UI updates instantly.
    const res = await declareResult({
      marketId, sessionDate: date, session, pana, confirmationText,
    });
    setBusy(false);

    if (!res.ok) {
      // DB write succeeded; just surface the local-mirror warning quietly.
      toast.success(`Result declared for ${market?.displayName} ${session} — Pana ${pana}`);
      setOpen(false);
      reset();
      qc.invalidateQueries();
      return { ok: true as const };
    }

    setOpen(false);
    toast.success(
      `Result declared for ${market?.displayName} ${session} — Digit ${res.digit}, Pana ${pana}`,
      { description: res.settledBets ? `${res.settledBets} bets settled · ₹${res.totalPayout.toLocaleString("en-IN")} paid out` : "No bets to settle." },
    );
    burstConfetti();
    reset();
    qc.invalidateQueries();
    return { ok: true as const };
  }

  return (
    <>
      <Button
        id="declare-button"
        size="lg"
        onClick={() => setOpen(true)}
        disabled={!enabled}
        className={cn(
          "w-full h-14 text-base font-display font-bold tracking-wider",
          "bg-gradient-gold text-background hover:brightness-110",
          enabled && "shadow-[0_0_24px_rgba(245,158,11,0.45)] animate-[goldPulse_2.4s_ease-in-out_infinite]",
        )}
      >
        {busy ? (
          <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Declaring…</>
        ) : (
          <><Target className="h-5 w-5 mr-2" /> Declare Result for {market?.displayName ?? "Market"} {session}</>
        )}
      </Button>

      {!enabled && !busy && (
        <p className="mt-2 text-xs text-center text-muted-foreground">
          {market?.status === "SUSPENDED"
            ? "Cannot declare — market is suspended."
            : !marketId
              ? "Select a market first."
              : !valid
                ? "Enter a valid pana to continue."
                : null}
        </p>
      )}

      <ConfirmDeclareDialog
        open={open}
        onOpenChange={(v) => !busy && setOpen(v)}
        onConfirm={handleConfirm}
        busy={busy}
      />
    </>
  );
}

function burstConfetti() {
  if (typeof document === "undefined") return;
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(root);
  const colors = ["#f59e0b", "#10b981", "#6366f1", "#ec4899"];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("span");
    const left = Math.random() * 100;
    const delay = Math.random() * 0.4;
    const dur = 1.4 + Math.random() * 1.2;
    p.style.cssText = `position:absolute;top:-12px;left:${left}vw;width:8px;height:14px;background:${colors[i % colors.length]};transform:rotate(${Math.random()*360}deg);border-radius:2px;animation:confettiFall ${dur}s ${delay}s ease-in forwards;opacity:0.9`;
    root.appendChild(p);
  }
  setTimeout(() => root.remove(), 2400);
}
