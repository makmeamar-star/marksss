import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — SattaKing Pro" },
      { name: "description", content: "When and how SattaKing Pro processes refunds." },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <LegalLayout title="Refund Policy" subtitle="Clear rules on refunds and disputed transactions." updated="May 10, 2026">
      <h2>Successful deposits</h2>
      <p>Once a deposit is credited and the balance has been used to place bets, refunds are not available except in cases of confirmed system error.</p>
      <h2>Failed deposits</h2>
      <p>If your bank statement shows a debit but the balance was not credited within 30 minutes, raise a ticket with the UTR. We will reconcile within 24 hours.</p>
      <h2>Voided bets</h2>
      <p>Bets voided due to a system error, market closure error, or result correction will be refunded in full to your wallet within 1 hour.</p>
      <h2>Withdrawal SLAs</h2>
      <p>Withdrawals are processed within 24 hours of approval. Bank-side delays are outside our control. KYC must be completed before any withdrawal.</p>
      <h2>Chargebacks</h2>
      <p>Initiating a payment chargeback without first contacting our support team will result in immediate account suspension.</p>
    </LegalLayout>
  );
}
