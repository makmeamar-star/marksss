import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  isRedirect,
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
import { supabase } from "@/integrations/supabase/client";

import { ShieldX } from "lucide-react";
import { toast } from "sonner";

import { requireAdminSSR } from "@/lib/adminGuardSSR.functions";

type DiagCheck = { name: string; ok: boolean; detail: string };
const DIAG_KEY = "admin_access_diag";

function saveDiag(checks: DiagCheck[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      DIAG_KEY,
      JSON.stringify({ checks, at: new Date().toISOString() }),
    );
  } catch {}
}

export const Route = createFileRoute("/admin")({
  // NOTE: Admin authorization is enforced server-side on every mutation
  // (see src/lib/adminGuard.functions.ts and adminDeclare.functions.ts,
  // both of which check user_roles via supabaseAdmin). The previous
  // client-side gate caused false-positive 403s when the auth store or
  // session hadn't fully hydrated. The gate has been removed; the layout
  // simply requires the user to be signed in.
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;

    // Ensure auth store is hydrated, then require a signed-in session.
    let { user, hydrated } = useAuthStore.getState();
    if (!hydrated) {
      await useAuthStore.getState().bootstrap();
      ({ user, hydrated } = useAuthStore.getState());
    }

    if (!user) {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        toast.error("Please sign in to access admin");
        throw redirect({ to: "/login", search: { redirect: location.href } as never });
      }
    }
  },
  errorComponent: ({ error, reset }) => {
    if (isRedirect(error)) return null;
    return (
      <div className="min-h-screen grid place-items-center bg-background px-6 py-10">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive/15 text-destructive">
            <ShieldX className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-display font-bold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">{error?.message ?? "Unknown error"}</p>
          <Button onClick={() => reset()}>Retry</Button>
        </div>
      </div>
    );
  },
  head: () => ({ meta: [{ title: "Admin — SattaKing Pro" }] }),
  component: AdminLayout,
});


const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/markets", label: "Markets", icon: Store },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/bets", label: "Bets Monitor", icon: Activity },
  { to: "/admin/results/declare", label: "Declare Results", icon: Trophy },
  { to: "/admin/results/history", label: "Result History", icon: History },
  { to: "/admin/results/automation", label: "Automation", icon: Zap },
  { to: "/admin/results/scrape", label: "Scraper", icon: Globe },
  { to: "/admin/deposits", label: "Deposits", icon: Wallet },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowLeftRight },
  { to: "/admin/payments", label: "Payment Channels", icon: CreditCard },
  { to: "/admin/support", label: "Customer Support", icon: MessageCircle },
  { to: "/admin/kyc", label: "KYC Review", icon: ShieldCheck },
] as const;

const ADVANCED_NAV = [
  { to: "/admin/results/automation-runs", label: "Automation Runs", icon: History },
  { to: "/admin/results/automation-audit", label: "Automation Audit", icon: FileSearch },
  { to: "/admin/results/alerts", label: "Result Alerts", icon: ShieldAlert },
  { to: "/admin/results/observations", label: "Observations", icon: FileSearch },
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
  const [advOpen, setAdvOpen] = useState(false);
  const renderLink = (n: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }) => {
    const active = n.exact ? path === n.to : path === n.to || path.startsWith(n.to + "/");
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
  };
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
      {NAV.map((n) => renderLink(n as never))}
      <button
        type="button"
        onClick={() => setAdvOpen((v) => !v)}
        className="w-full text-left mt-3 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {advOpen ? "▾" : "▸"} Advanced
      </button>
      {advOpen && ADVANCED_NAV.map((n) => renderLink(n as never))}
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
