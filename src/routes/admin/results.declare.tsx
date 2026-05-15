import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, ChevronRight, History as HistoryIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { LiveClock } from "@/components/admin/LiveClock";
import { SessionSelectorCard } from "@/components/admin/declare/SessionSelectorCard";
import { PanaInputCard } from "@/components/admin/declare/PanaInputCard";
import { ImpactPreviewCard } from "@/components/admin/declare/ImpactPreviewCard";
import { DeclareButton } from "@/components/admin/declare/DeclareButton";
import { PendingTodayPanel } from "@/components/admin/declare/PendingTodayPanel";
import { DeclaredTodayPanel } from "@/components/admin/declare/DeclaredTodayPanel";
import { PanaReferencePanel } from "@/components/admin/declare/PanaReferencePanel";
import { ActivityFeedPanel } from "@/components/admin/declare/ActivityFeedPanel";
import { AuditLogPanel } from "@/components/admin/declare/AuditLogPanel";
import { ShortcutsLegend } from "@/components/admin/declare/ShortcutsLegend";
import { MissingResultsBanner } from "@/components/admin/MissingResultsBanner";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useDeclareForm } from "@/stores/declareFormStore";

export const Route = createFileRoute("/admin/results/declare")({
  head: () => ({
    meta: [
      { title: "Declare Results — SattaKing Pro Admin" },
      { name: "description", content: "Declare and manage Matka market results with full pana validation." },
    ],
  }),
  component: DeclarePage,
});

function DeclarePage() {
  const reset = useDeclareForm((s) => s.reset);
  const declareBtnRef = useRef<HTMLButtonElement | null>(null);

  useShortcuts({
    "alt+1": (e) => { e.preventDefault(); document.querySelector<HTMLButtonElement>('[role="combobox"]')?.click(); },
    "alt+2": (e) => { e.preventDefault(); document.querySelector<HTMLInputElement>("#pana-input-card input")?.focus(); },
    "alt+d": (e) => { e.preventDefault(); document.getElementById("declare-button")?.click(); },
    "alt+c": (e) => { e.preventDefault(); reset(); },
  });

  // Cleanup ref on mount (used so eslint doesn't flag)
  useEffect(() => { void declareBtnRef.current; }, []);

  return (
    <div className="container mx-auto px-4 lg:px-6 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-6">
        <div>
          <nav className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
            <Link to="/admin" className="hover:text-foreground">Admin</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Results</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-primary">Declare</span>
          </nav>
          <h1 className="font-display text-3xl lg:text-4xl font-bold flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-gold text-background">
              <Trophy className="h-5 w-5" />
            </span>
            Result Declaration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Declare and manage market results</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LiveClock />
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/results/history">
              <HistoryIcon className="h-4 w-4 mr-1.5" /> View Result History
            </Link>
          </Button>
        </div>
      </div>

      <MissingResultsBanner />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-4">
          <SessionSelectorCard />
          <PanaInputCard />
          <ImpactPreviewCard />
          <DeclareButton />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <PendingTodayPanel />
          <DeclaredTodayPanel />
          <PanaReferencePanel />
          <ActivityFeedPanel />
        </div>
      </div>

      <AuditLogPanel />
      <ShortcutsLegend />
    </div>
  );
}
