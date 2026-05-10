import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Bharat Trust — SattaKing Pro" },
      { name: "description", content: "Why we built SattaKing Pro and the principles behind it." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <LegalLayout title="About Bharat Trust" subtitle="Our commitment to fair, safe, and transparent play.">
      <p>SattaKing Pro is built on four trust pillars:</p>
      <ul>
        <li><strong>Provably fair</strong> — every Quick Play round publishes a seed hash before the round opens, and the seed itself after the result.</li>
        <li><strong>Player protection</strong> — built-in self-set limits, cool-off periods, and one-tap self-exclusion.</li>
        <li><strong>Verified identity</strong> — tiered KYC keeps the platform safe from fraud, bot accounts, and underage play.</li>
        <li><strong>Transparent ops</strong> — public results archive with auditable proof for every settled round.</li>
      </ul>
      <h2>Who we are</h2>
      <p>We are a small team of engineers, product designers, and risk operators who love Indian games of skill and want to bring world-class trust to the format. Reach us at <a href="mailto:hello@sattakingpro.in">hello@sattakingpro.in</a>.</p>
    </LegalLayout>
  );
}
