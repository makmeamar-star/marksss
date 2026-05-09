import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Store, Receipt, BarChart3, Wallet, Bell, User, LogOut, Crown, Trophy, Menu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { useBetStore } from "@/stores/betStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { WinCelebration } from "@/components/WinCelebration";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("skp-auth");
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed?.state?.user) {
        throw redirect({ to: "/login" });
      }
    } catch (e) {
      if (e instanceof Error && "to" in e) throw e;
      throw redirect({ to: "/login" });
    }
  },
  component: AuthLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/markets", label: "Markets", icon: Store },
  { to: "/my-bets", label: "My Bets", icon: Receipt },
  { to: "/results", label: "Results", icon: Trophy },
  { to: "/charts", label: "Charts", icon: BarChart3 },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function AuthLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const lastWin = useBetStore((s) => s.lastWin);
  const clearLastWin = useBetStore((s) => s.clearLastWin);
  const unread = useNotificationStore((s) =>
    user ? s.notifications.filter((n) => n.userId === user.id && !n.read).length : 0
  );

  // hydration-safe re-render after persist mounts
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar">
        <SidebarHeader />
        <SidebarNav unread={unread} />
        <SidebarFooter user={user} onLogout={logout} hydrated={hydrated} />
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 backdrop-blur px-4 h-14">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar border-border/60 p-0 w-72">
              <SidebarHeader />
              <SidebarNav />
              <SidebarFooter user={user} onLogout={logout} hydrated={hydrated} />
            </SheetContent>
          </Sheet>
          <Link to="/dashboard" className="font-display font-bold text-lg">
            Satta<span className="text-primary">King</span> Pro
          </Link>
          <BalancePill balance={user?.balance ?? 0} />
        </header>

        <main className="flex-1 pb-20 lg:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur grid grid-cols-5">
          {NAV.slice(0, 5).map((n) => (
            <BottomLink key={n.to} to={n.to} icon={n.icon} label={n.label} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function SidebarHeader() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2 px-5 h-16 border-b border-border/60">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-background">
        <Crown className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <div className="font-display text-lg font-bold">Satta<span className="text-primary">King</span> Pro</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground -mt-0.5">Player Console</div>
      </div>
    </Link>
  );
}

function SidebarNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
      {NAV.map((n) => {
        const active = path === n.to || path.startsWith(n.to + "/");
        const Icon = n.icon;
        return (
          <Link
            key={n.to}
            to={n.to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors
              ${active
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" /> {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ user, onLogout, hydrated }: { user: ReturnType<typeof useAuthStore.getState>["user"]; onLogout: () => void; hydrated: boolean }) {
  if (!hydrated) return null;
  return (
    <div className="border-t border-border/60 p-3 space-y-2">
      <div className="glass-gold rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Balance</div>
        <div className="font-mono text-2xl font-bold text-primary text-glow-gold">
          ₹{(user?.balance ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </div>
      </div>
      <div className="flex items-center gap-2 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary/20 text-secondary text-sm font-bold">
          {(user?.username ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{user?.username}</div>
          <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
        </div>
        <Button size="icon" variant="ghost" onClick={onLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function BalancePill({ balance }: { balance: number }) {
  return (
    <div className="rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-mono text-primary">
      ₹{balance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
    </div>
  );
}

function BottomLink({ to, icon: Icon, label }: { to: string; icon: typeof Crown; label: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = path === to || path.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]
        ${active ? "text-primary" : "text-muted-foreground"}`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
