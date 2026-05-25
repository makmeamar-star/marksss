import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Crown, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin-login")({
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
    if (roleRow) throw redirect({ to: "/admin" });
  },
  head: () => ({ meta: [{ title: "Admin Login — SattaKing Pro" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Enter admin email and password");
    setBusy(true);
    try {
      const u = await login(email, password);
      const isAdmin = u?.role === "ADMIN" || u?.role === "SUPER_ADMIN";
      if (!isAdmin) {
        await supabase.auth.signOut();
        toast.error("This account does not have admin access.");
        return;
      }
      toast.success("Welcome, admin.");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background bg-radial-spotlight px-4">
      <div className="w-full max-w-sm space-y-6">
        <Link to="/" className="flex items-center gap-2 justify-center">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-gold text-background">
            <Crown className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold">
            Satta<span className="text-primary">King</span> Pro
          </span>
        </Link>

        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <h1 className="font-display text-xl font-bold">Admin Sign In</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Restricted area. Only authorized admin accounts can sign in here.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourdomain.com" autoComplete="email" />
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
            <Button type="submit" disabled={busy} className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
              {busy ? "Signing in…" : "Sign In as Admin"}
            </Button>
          </form>
        </div>

        <Link to="/login" className="flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to player login
        </Link>
      </div>
    </div>
  );
}
