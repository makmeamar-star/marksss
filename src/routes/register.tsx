import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Register — SattaKing Pro" }] }),
  component: RegisterStub,
});

function RegisterStub() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-4xl font-bold">Create your account</h1>
        <p className="text-muted-foreground mt-3 max-w-md mx-auto">
          Coming in Phase 2 — full registration with referral codes, OTP verification, and welcome bonus.
        </p>
        <Link to="/" className="inline-block mt-6 text-primary hover:underline">← Back home</Link>
      </section>
    </div>
  );
}
