import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout } from "@/components/LegalLayout";
import { ShieldCheck, Clock, Ban, Phone } from "lucide-react";

export const Route = createFileRoute("/responsible-gaming")({
  head: () => ({
    meta: [
      { title: "Responsible Gaming — SattaKing Pro" },
      { name: "description", content: "Tools and resources to keep your play safe and within limits." },
    ],
  }),
  component: ResponsibleGamingPage,
});

function ResponsibleGamingPage() {
  return (
    <LegalLayout title="Responsible Gaming" subtitle="Stay in control. Play for fun. Never chase losses.">
      <div className="not-prose grid gap-4 md:grid-cols-2 my-6">
        <div className="rounded-xl border border-border/60 bg-surface/40 p-5">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h3 className="mt-2 font-display text-lg">Set a limit</h3>
          <p className="text-sm text-muted-foreground mt-1">Cap your daily and weekly bets so play stays affordable.</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/40 p-5">
          <Clock className="h-6 w-6 text-primary" />
          <h3 className="mt-2 font-display text-lg">Cool off</h3>
          <p className="text-sm text-muted-foreground mt-1">Take a 24-hour, 7-day, or 30-day break at any time.</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/40 p-5">
          <Ban className="h-6 w-6 text-primary" />
          <h3 className="mt-2 font-display text-lg">Self-exclude</h3>
          <p className="text-sm text-muted-foreground mt-1">Permanently close your account if play stops being fun.</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/40 p-5">
          <Phone className="h-6 w-6 text-primary" />
          <h3 className="mt-2 font-display text-lg">Get help</h3>
          <p className="text-sm text-muted-foreground mt-1">iCall India helpline: <a href="tel:+919152987821" className="text-primary">+91 91529 87821</a></p>
        </div>
      </div>

      <p>Manage all of these tools from your <Link to="/_authenticated/settings/limits" className="text-primary">Play Limits</Link> page.</p>

      <h2>Warning signs</h2>
      <ul>
        <li>Spending more than you can afford to lose.</li>
        <li>Chasing losses with bigger bets.</li>
        <li>Betting to escape stress or sadness.</li>
        <li>Hiding play from family or friends.</li>
      </ul>

      <h2>Provably-fair play</h2>
      <p>Each Quick Play round publishes a SHA-256 hash of the server seed <em>before</em> bets close. After the round, the seed and nonce are revealed so you can independently verify the result. See the <Link to="/results" className="text-primary">results archive</Link> for the live proof feed.</p>

      <h2>Helplines</h2>
      <ul>
        <li><strong>iCall</strong> — +91 91529 87821 (Mon–Sat, 8am–10pm)</li>
        <li><strong>Vandrevala Foundation</strong> — 1860 266 2345 (24×7)</li>
      </ul>
    </LegalLayout>
  );
}
