import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";

export function SiteHeader() {
  const isAuthed = useAuthStore((s) => !!s.user);
  const homeTo = isAuthed ? "/dashboard" : "/";
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-12 items-center justify-between px-4">
        <Link to={homeTo} className="flex items-center gap-2 group">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-gold text-background shadow-[0_0_20px_-4px_var(--primary)]">
            <Crown className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="font-display text-base font-bold tracking-wide text-foreground">
              Satta<span className="text-primary text-glow-gold">King</span> Pro
            </div>
            <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground -mt-0.5">
              Trusted Matka Platform
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { to: homeTo, label: "Home" },
            { to: "/markets", label: "Markets" },
            { to: "/jodi", label: "Jodi 00–99" },
            { to: "/results", label: "Results" },
            { to: "/charts", label: "Charts" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              preload="intent"
              className="px-2 py-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              activeProps={{ className: "px-2 py-1.5 text-xs text-primary font-semibold" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center text-[10px] text-success pulse-live">LIVE</span>
          {isAuthed ? (
            <Button asChild size="sm" className="bg-gradient-gold text-background font-semibold hover:opacity-90">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="text-foreground">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild size="sm" className="bg-gradient-gold text-background font-semibold hover:opacity-90">
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
