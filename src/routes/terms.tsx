import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — SattaKing Pro" },
      { name: "description", content: "Terms of service governing your use of SattaKing Pro." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions" subtitle="Please read these terms carefully before using SattaKing Pro." updated="May 10, 2026">
      <h2>1. Eligibility</h2>
      <p>You must be at least 18 years of age and legally permitted to place skill-based wagers in your jurisdiction. We reserve the right to verify age and identity at any time.</p>
      <h2>2. Account & KYC</h2>
      <p>Each user may hold one account. Withdrawals require completion of identity verification (KYC). Providing false information will result in account suspension and forfeiture of balance.</p>
      <h2>3. Fair Play</h2>
      <p>Result generation for Quick Play uses a provably-fair seed-and-hash protocol. Verification details are available on the <a href="/responsible-gaming">Provably Fair</a> page. Use of bots, automation, multi-accounting or collusion is forbidden.</p>
      <h2>4. Wallets & Settlements</h2>
      <p>Bonus balances are subject to a 1× wagering requirement before withdrawal. Real-money settlements occur within stated SLAs. We reserve the right to void bets placed during system errors or pricing mistakes.</p>
      <h2>5. Suspension & Termination</h2>
      <p>We may suspend or terminate accounts for fraud, abuse, regulatory reasons, or violation of these terms. Genuine balance will be refunded after compliance checks.</p>
      <h2>6. Limitation of Liability</h2>
      <p>To the extent permitted by law, our liability for any single dispute is capped at the disputed transaction amount.</p>
      <h2>7. Governing Law</h2>
      <p>These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts of Mumbai.</p>
      <h2>8. Changes</h2>
      <p>We may update these terms from time to time. Continued use after a change constitutes acceptance of the new terms.</p>
    </LegalLayout>
  );
}
