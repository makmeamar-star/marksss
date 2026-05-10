import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SattaKing Pro" },
      { name: "description", content: "How SattaKing Pro collects, uses, and protects your personal information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" subtitle="Your data, handled with care." updated="May 10, 2026">
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data</strong> — username, email, phone number.</li>
        <li><strong>KYC data</strong> — name, date of birth, masked PAN, document images.</li>
        <li><strong>Transactional data</strong> — deposits, withdrawals, bets, balances.</li>
        <li><strong>Technical data</strong> — IP address, device fingerprint, user agent, error logs.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To operate the platform, settle bets, and process payments.</li>
        <li>To meet legal obligations including KYC, AML, and tax reporting.</li>
        <li>To detect fraud, multi-accounting, and abuse.</li>
        <li>To improve product, with anonymized analytics only.</li>
      </ul>
      <h2>Storage & retention</h2>
      <p>Data is stored on encrypted infrastructure. KYC documents are kept for the duration required by law (typically 7 years) and then deleted.</p>
      <h2>Your rights</h2>
      <p>You may request a copy or deletion of your personal data, subject to legal retention requirements. Contact <a href="mailto:privacy@sattakingpro.in">privacy@sattakingpro.in</a>.</p>
      <h2>Cookies</h2>
      <p>We use first-party cookies to keep you signed in. We do not sell your data to third parties.</p>
    </LegalLayout>
  );
}
