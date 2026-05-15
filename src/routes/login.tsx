import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Crown, Sparkles, Trophy, Zap, User, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";

const DEMO_EMAIL = "player@sattaking.test";
const DEMO_PASSWORD = "DemoPlayer@2026";
const DEMO_ADMIN_EMAIL = "admin@sattaking.test";
const DEMO_ADMIN_PASSWORD = "DemoAdmin@2026";



export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    throw redirect({ to: roleRow ? "/admin" : "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Login — SattaKing Pro" }] }),
  component: LoginPage,
});

function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [demoEnabled, setDemoEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("app_settings").select("value").eq("key", "demo_login_enabled").maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const v = (data?.value as { enabled?: boolean } | null)?.enabled;
        setDemoEnabled(v ?? true);
      });
    return () => { cancelled = true; };
  }, []);

  const applyRemember = (val: boolean) => {
    if (typeof window === "undefined") return;
    if (val) {
      localStorage.removeItem("auth_remember_off");
    } else {
      localStorage.setItem("auth_remember_off", "1");
      sessionStorage.setItem("auth_alive", "1");
    }
  };

  const anyBusy = busy;

  const goByRole = async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) {
      navigate({ to: "/dashboard" });
      return;
    }
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    navigate({ to: roleRow ? "/admin" : "/dashboard" });
  };

  const demoLogin = async () => {
    setBusy(true);
    try {
      applyRemember(remember);
      await login(DEMO_EMAIL, DEMO_PASSWORD);
      toast.success("Welcome back, demo player!");
      await goByRole();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setBusy(false);
    }
  };

  const demoAdminLogin = async () => {
    setBusy(true);
    try {
      applyRemember(remember);
      await login(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD);
      toast.success("Welcome back!");
      await goByRole();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo admin login failed");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("Enter email and password");
      return;
    }
    setBusy(true);
    try {
      applyRemember(remember);
      await login(identifier, password);
      toast.success(`Welcome back!`);
      await goByRole();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-radial-spotlight border-r border-border/60 overflow-hidden">
        <div className="absolute inset-0 particles-bg opacity-30 pointer-events-none" />
        <Link to="/" className="flex items-center gap-2 relative">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-background">
            <Crown className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold">
            Satta<span className="text-primary">King</span> Pro
          </span>
        </Link>
        <div className="relative space-y-6">
          <h2 className="font-display text-4xl font-bold">
            Welcome back, <span className="text-primary text-glow-gold">player</span>.
          </h2>
          <ul className="space-y-3 text-muted-foreground">
            <Perk icon={<Zap />} text="Instant settlements the moment results are declared" />
            <Perk icon={<Trophy />} text="Live results across 8 major Matka markets" />
            <Perk icon={<Sparkles />} text="Welcome bonus + referral rewards" />
          </ul>
        </div>
        <p className="text-xs text-muted-foreground/60 relative">
          Prototype build · No real money is exchanged.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="font-display text-3xl font-bold">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your SattaKing Pro account.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="id">Email</Label>
            <Input id="id" type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pwd">Password</Label>
            <div className="relative">
              <Input id="pwd" type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPwd((x) => !x)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-primary">
                {showPwd ? "hide" : "show"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none"><input type="checkbox" className="accent-[var(--primary)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={async () => {
                if (!identifier || !identifier.includes("@")) {
                  toast.error("Enter your account email above first");
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(identifier, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success("Password reset email sent");
              }}
            >Forgot password?</button>
          </div>

          <Button type="submit" disabled={anyBusy} className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
            {busy ? "Signing in…" : "Sign In"}
          </Button>

          {demoEnabled === null ? (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    <span className="inline-block h-3 w-24 animate-pulse rounded bg-muted" />
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            </>
          ) : demoEnabled ? (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Demo test accounts</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant="outline" disabled={anyBusy} onClick={demoLogin} className="w-full">
                  <User className="mr-2 h-4 w-4" />
                  {busy ? "Loading…" : "Demo User"}
                </Button>
                <Button type="button" variant="outline" disabled={anyBusy} onClick={demoAdminLogin} className="w-full">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {busy ? "Loading…" : "Demo Admin"}
                </Button>
              </div>
            </>
          ) : null}

          <p className="text-sm text-center text-muted-foreground">
            Don't have an account? <Link to="/register" className="text-primary hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Perk({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary shrink-0">
        {icon}
      </span>
      <span>{text}</span>
    </li>
  );
}
