import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — SattaKing Pro" }] }),
  component: () => <Stub title="Login" />,
});

function Stub({ title }: { title: string }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-3 max-w-md mx-auto">
          Coming in Phase 2 — full auth UI with the dark gold treatment, real-time username availability, OTP, and password strength meter.
        </p>
        <Link to="/" className="inline-block mt-6 text-primary hover:underline">← Back home</Link>
      </section>
    </div>
  );
}
