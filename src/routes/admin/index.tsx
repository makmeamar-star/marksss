import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <h1 className="font-display text-4xl font-bold">Admin Dashboard</h1>
      <p className="text-muted-foreground mt-2">
        The full admin surface lands in Phase 4. Result declaration is live now.
      </p>

      <Link
        to="/admin/results/declare"
        className="mt-8 group flex items-center justify-between rounded-2xl glass-gold p-6 hover:ring-gold transition-all"
      >
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-gold text-background">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <div className="font-display text-2xl font-bold">Declare Results</div>
            <div className="text-sm text-muted-foreground">
              Enter Open/Close pana with full validation, financial impact preview, and 10-min correction window.
            </div>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}
