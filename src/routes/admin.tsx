import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import {
  LayoutDashboard, Trophy, Wallet, Crown, LogOut, Menu,
  Store, ArrowLeftRight, History, Zap, Globe, FileSearch, Users, Activity, Megaphone, ShieldAlert, CreditCard, ShieldCheck, BarChart3, MessageCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuthStore } from "@/stores/authStore";
import { LiveClock } from "@/components/admin/LiveClock";

import { ShieldX } from "lucide-react";
import { toast } from "sonner";

import { requireAdminSSR } from "@/lib/adminGuardSSR.functions";

export const Route = createFileRoute("/admin")({
  // SSR-safe: runs on both server (reading sb-access-token cookie set by
  // useAuthCookieSync) and client (via attached Bearer header). Returns
  // { ok: boolean } so we redirect — never throws a 403 during SSR.
  beforeLoad: async ({ location }) => {
    // Fast path: on the client, if the auth store already knows we're an admin
    // (loaded by bootstrap or login), skip the server round-trip entirely.
    if (typeof window !== "undefined") {
      const { user, hydrated } = useAuthStore.getState();
      if (hydrated && user) {
        if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return;
        // Hydrated but not admin → bounce immediately, no server call.
        toast.error("Admin access required", {
          description: "Please sign in with an admin account.",
        });
        throw redirect({
          to: "/login",
          search: { redirect: location.href, error: "forbidden" } as never,
        });
      }
    }
    try {
      const result = await requireAdminSSR();
      if (result?.ok) return;
    } catch {
      // Treat any transport/runtime error as "not authorized" and redirect.
    }
    if (typeof window !== "undefined") {
      toast.error("Admin access required", {
        description: "Please sign in with an admin account.",
      });
    }
    throw redirect({
      to: "/login",
      search: { redirect: location.href, error: "forbidden" } as never,
    });
  },
  // Admin check is done client-side in beforeLoad above (which has session access).
  // Calling requireAdmin() as a server-fn loader fails during SSR/prerender (no Bearer
  // token attached yet) and returns 403, blocking legit admins on hard navigation.
  errorComponent: () => <Forbidden403 />,
  head: () => ({ meta: [{ title: "Admin — SattaKing Pro" }] }),
  component: AdminLayout,
});

function Forbidden403() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof window !== "undefined") window.location.replace("/login");
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive/15 text-destructive">
          <ShieldX className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-display font-bold">403 — Forbidden</h1>
        <p className="text-muted-foreground">
          Admin access required. Redirecting to the login page…
        </p>
        <Button onClick={() => window.location.replace("/login")}>Go to Login</Button>
      </div>
    </div>
  );
}

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/markets", label: "Markets", icon: Store },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/bets", label: "Bets Monitor", icon: Activity },
  { to: "/admin/results/declare", label: "Declare Results", icon: Trophy },
  { to: "/admin/results/history", label: "Result History", icon: History },
  { to: "/admin/results/automation", label: "Automation", icon: Zap },
  { to: "/admin/results/scrape", label: "Scraper", icon: Globe },
  { to: "/admin/results/automation-runs", label: "Automation Runs", icon: History },
  { to: "/admin/results/automation-audit", label: "Automation Audit", icon: FileSearch },
  { to: "/admin/deposits", label: "Deposits", icon: Wallet },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowLeftRight },
  { to: "/admin/payments", label: "Payment Channels", icon: CreditCard },
  { to: "/admin/support", label: "Customer Support", icon: MessageCircle },
  { to: "/admin/kyc", label: "KYC Review", icon: ShieldCheck },
  { to: "/admin/broadcasts", label: "Broadcasts", icon: Megaphone },
  { to: "/admin/risk", label: "Risk & Ops", icon: ShieldAlert },
  { to: "/admin/monitoring", label: "Monitoring", icon: ShieldAlert },
  { to: "/admin/analytics/pwa", label: "PWA Funnel", icon: BarChart3 },
] as const;

function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setHydrated(true), []);
  // Close mobile drawer whenever the route changes
  useEffect(() => { setMobileOpen(false); }, [path]);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar">
        <SidebarHeader />
        <SidebarNav />
        <SidebarFooter user={user} onLogout={logout} hydrated={hydrated} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 backdrop-blur px-4 h-14">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar border-border/60 p-0 w-72">
              <SidebarHeader />
              <SidebarNav />
              <SidebarFooter user={user} onLogout={logout} hydrated={hydrated} />
            </SheetContent>
          </Sheet>
          <span className="font-display font-bold text-lg">
            Satta<span className="text-primary">King</span> · Admin
          </span>
          <LiveClock compact />
        </header>

        <main className="flex-1 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarHeader() {
  return (
    <Link to="/admin" className="flex items-center gap-2 px-5 h-16 border-b border-border/60">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-background">
        <Crown className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <div className="font-display text-lg font-bold">Satta<span className="text-primary">King</span> Pro</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-primary -mt-0.5">Admin Console</div>
      </div>
    </Link>
  );
}

function SidebarNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
      {NAV.map((n) => {
        const active = "exact" in n && n.exact
          ? path === n.to
          : path === n.to || path.startsWith(n.to + "/");
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
            <Icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  user, onLogout, hydrated,
}: {
  user: ReturnType<typeof useAuthStore.getState>["user"];
  onLogout: () => void | Promise<void>;
  hydrated: boolean;
}) {
  if (!hydrated) return null;
  return (
    <div className="border-t border-border/60 p-3 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-primary text-sm font-bold">
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
