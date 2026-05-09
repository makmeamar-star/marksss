import { createFileRoute } from "@tanstack/react-router";

function makeStub(title: string, blurb: string) {
  return function Stub() {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-4xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-3 max-w-md mx-auto">{blurb}</p>
        <p className="text-xs text-muted-foreground/70 mt-6">Arriving in Phase 3</p>
      </div>
    );
  };
}

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — SattaKing Pro" }] }),
  component: makeStub("Wallet", "Deposit, withdraw, and view your transaction history with UPI, IMPS, and bank flows."),
});
