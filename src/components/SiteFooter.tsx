import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface/40 mt-20">
      <div className="container mx-auto px-4 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-background">
              <Crown className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold">
              Satta<span className="text-primary">King</span> Pro
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-3 max-w-md">
            India's most trusted Matka platform. Live results, lightning-fast settlements,
            and a beautifully crafted betting experience.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-4 max-w-md">
            Disclaimer: This is a UI prototype for demonstration purposes only. Online
            gambling and Matka are illegal in many jurisdictions. Comply with local laws.
          </p>
        </div>

        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-foreground mb-3">Platform</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/markets" className="hover:text-primary">Markets</Link></li>
            <li><Link to="/results" className="hover:text-primary">Results</Link></li>
            <li><Link to="/charts" className="hover:text-primary">Charts</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm uppercase tracking-widest text-foreground mb-3">Account</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/login" className="hover:text-primary">Login</Link></li>
            <li><Link to="/register" className="hover:text-primary">Register</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SattaKing Pro · Prototype build
      </div>
    </footer>
  );
}
