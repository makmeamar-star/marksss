import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — SattaKing Pro" }] }),
  component: () => (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="font-display text-4xl font-bold">Notifications</h1>
      <p className="text-muted-foreground mt-3 max-w-md mx-auto">Result alerts, bet outcomes and admin broadcasts will appear here.</p>
      <p className="text-xs text-muted-foreground/70 mt-6">Arriving in Phase 3</p>
    </div>
  ),
});
