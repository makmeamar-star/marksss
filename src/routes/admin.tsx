import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — SattaKing Pro" }] }),
  component: () => (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="font-display text-5xl font-bold">Admin Panel</h1>
      <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
        Full admin console — markets, results management with the settlement engine, users, deposits/withdrawals, broadcasts, and reports — arrives in Phase 4.
      </p>
    </div>
  ),
});
