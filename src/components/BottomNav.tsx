import { Link, useLocation } from "@tanstack/react-router";
import { Home, LayoutGrid, BarChart3, Wallet, User } from "lucide-react";
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
 * on routes that ship their own navigation.
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
      <div className="md:hidden h-16" aria-hidden />

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="relative grid grid-cols-5 h-14 items-center text-[10px]">
          <Tab to={homeTo} icon={<Home className="h-4 w-4" />} label="Home" active={isAuthed ? isActive("/dashboard") : isActive("/", true)} />
          <Tab to="/markets" icon={<LayoutGrid className="h-4 w-4" />} label="Markets" active={isActive("/markets")} />
          <Tab to="/results" icon={<BarChart3 className="h-4 w-4" />} label="Results" active={isActive("/results")} />
          <Tab to="/wallet" icon={<Wallet className="h-4 w-4" />} label="Wallet" active={isActive("/wallet")} />
          <Tab to="/profile" icon={<User className="h-4 w-4" />} label="Profile" active={isActive("/profile")} />
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
      className={`flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className={`relative ${active ? "drop-shadow-[0_0_8px_var(--primary)]" : ""}`}>
        {icon}
        {active && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary" />
        )}
      </span>
      <span className="text-[9px] font-medium tracking-wide">{label}</span>
    </Link>
  );
}
