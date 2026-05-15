import { Link, useLocation } from "@tanstack/react-router";
import { Home, LayoutGrid, Star, Wallet, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

// Routes that already render their own navigation (auth shell, admin, auth pages).
const HIDDEN_PREFIXES = [
  "/admin", "/login", "/register", "/reset-password",
  // _authenticated layout routes — they have their own sidebar + bottom nav
  "/dashboard", "/wallet", "/my-bets", "/notifications", "/profile",
  "/rewards", "/kyc", "/settings", "/play", "/bet", "/leaderboard",
  "/achievements", "/referrals", "/starline",
];

/**
 * Mobile-first bottom navigation for PUBLIC pages. Hidden on md+ screens and
 * on routes that ship their own navigation. Center "Star" tab is the prominent
 * shortcut to the 4 featured markets (Gali / Disawar / Faridabad / Ghaziabad).
 *
 * When the visitor is signed in, the "Home" tab routes to their dashboard
 * instead of the public landing page so the back-button stays inside the app.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const isAuthed = useAuthStore((s) => !!s.user);
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const homeTo = isAuthed ? "/dashboard" : "/";

  const isActive = (to: string, exact = false) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <>
      {/* Spacer so page content isn't hidden behind the fixed bar */}
      <div className="md:hidden h-20" aria-hidden />

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="relative grid grid-cols-5 h-16 items-center text-[11px]">
          <Tab to={homeTo} icon={<Home className="h-5 w-5" />} label="Home" active={isAuthed ? isActive("/dashboard") : isActive("/", true)} />
          <Tab to="/markets" icon={<LayoutGrid className="h-5 w-5" />} label="Markets" active={isActive("/markets")} />

          {/* Center: prominent star tab, lifted above the bar */}
          <Link
            to="/star"
            preload="intent"
            className="relative -mt-7 mx-auto flex flex-col items-center"
            aria-label="Star markets"
          >
            <span
              className={`grid h-14 w-14 place-items-center rounded-full bg-gradient-gold text-background shadow-[0_8px_24px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)] ring-4 ring-background transition-transform ${
                isActive("/star") ? "scale-105" : ""
              }`}
            >
              <Star className="h-6 w-6 fill-current" strokeWidth={2.5} />
            </span>
            <span
              className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${
                isActive("/star") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Star
            </span>
          </Link>

          <Tab to="/wallet" icon={<Wallet className="h-5 w-5" />} label="Wallet" active={isActive("/wallet")} />
          <Tab to="/profile" icon={<User className="h-5 w-5" />} label="Profile" active={isActive("/profile")} />
        </div>
      </nav>
    </>
  );
}

function Tab({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      preload="intent"
      className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className={`relative ${active ? "drop-shadow-[0_0_8px_var(--primary)]" : ""}`}>
        {icon}
        {active && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-primary" />
        )}
      </span>
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </Link>
  );
}
