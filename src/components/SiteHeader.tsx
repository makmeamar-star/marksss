import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-background shadow-[0_0_20px_-4px_var(--primary)]">
            <Crown className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="font-display text-xl font-bold tracking-wide text-foreground">
              Satta<span className="text-primary text-glow-gold">King</span> Pro
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground -mt-0.5">
              Trusted Matka Platform
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { to: "/", label: "Home" },
            { to: "/markets", label: "Markets" },
            { to: "/jodi", label: "Jodi 00–99" },
            { to: "/results", label: "Results" },
            { to: "/charts", label: "Charts" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              activeProps={{ className: "px-3 py-2 text-sm text-primary font-semibold" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center text-xs text-success pulse-live">LIVE</span>
          <Button asChild variant="ghost" size="sm" className="text-foreground">
            <Link to="/login">Login</Link>
          </Button>
          <Button asChild size="sm" className="bg-gradient-gold text-background font-semibold hover:opacity-90">
            <Link to="/register">Register</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
