import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/results/history")({
  head: () => ({ meta: [{ title: "Result History — Admin" }] }),
  component: () => (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <Link to="/admin/results/declare" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Declare
      </Link>
      <h1 className="font-display text-4xl font-bold mt-4">Result History</h1>
      <p className="text-muted-foreground mt-2">
        Historical results browser arrives in Phase 4.5. Today's declared results and the 7-day audit log are visible on the Declare page.
      </p>
    </div>
  ),
});
