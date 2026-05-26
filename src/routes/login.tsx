import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Crown, Sparkles, Trophy, Zap, ShieldCheck, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    // Fast path: trust the in-memory auth store if it's already hydrated.
    const { user, hydrated } = useAuthStore.getState();
    if (hydrated) {
      if (!user) return;
      const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
      throw redirect({ to: isAdmin ? "/admin" : "/dashboard" });
    }
    // Cold load — fall back to a single round-trip to decide.
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  const applyRemember = (val: boolean) => {
    if (typeof window === "undefined") return;
    if (val) localStorage.removeItem("auth_remember_off");
    else {
      localStorage.setItem("auth_remember_off", "1");
      sessionStorage.setItem("auth_alive", "1");
    }
  };

  const goByRole = (user: { role?: string } | null) => {
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    navigate({ to: isAdmin ? "/admin" : "/dashboard" });
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Enter email and password");
    setBusy(true);
    try {
      applyRemember(remember);
      const u = await login(email, password);
      toast.success("Welcome back!");
      goByRole(u);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || `${provider} sign-in failed`);
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "OAuth failed");
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    if (!phone || phone.length < 8) return toast.error("Enter a valid phone number with country code (e.g. +91…)");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
      if (error) throw error;
      setOtpSent(true);
      toast.success("OTP sent to your phone");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp) return toast.error("Enter the OTP");
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) throw error;
      toast.success("Signed in!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setBusy(false);
    }
  };

  const sendEmailOtp = async () => {
    if (!email || !email.includes("@")) return toast.error("Enter a valid email");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      setEmailOtpSent(true);
      toast.success("6-digit code sent to your email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!emailOtp) return toast.error("Enter the code from your email");
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: emailOtp, type: "email" });
      if (error) throw error;
      toast.success("Signed in!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
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
        <p className="text-xs text-muted-foreground/60 relative">Prototype build · No real money is exchanged.</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="font-display text-3xl font-bold">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">New here? You'll be signed up automatically.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" disabled={busy} onClick={() => oauth("google")} className="w-full">
              <GoogleIcon className="mr-2 h-4 w-4" /> Google
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => oauth("apple")} className="w-full">
              <AppleIcon className="mr-2 h-4 w-4" /> Apple
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
          </div>

          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="email"><Mail className="mr-1.5 h-3.5 w-3.5" />Password</TabsTrigger>
              <TabsTrigger value="email-otp"><Mail className="mr-1.5 h-3.5 w-3.5" />Email OTP</TabsTrigger>
              <TabsTrigger value="phone"><Phone className="mr-1.5 h-3.5 w-3.5" />Phone</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4 pt-4">
              <form onSubmit={submitEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
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
                  <label className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" className="accent-[var(--primary)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
                  </label>
                  <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
                  {busy ? "Signing in…" : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="email-otp" className="space-y-4 pt-4">
              {!emailOtpSent ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email-otp-input">Email</Label>
                    <Input id="email-otp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                    <p className="text-[10px] text-muted-foreground">We'll email you a 6-digit code. New here? An account is created automatically.</p>
                  </div>
                  <Button type="button" onClick={sendEmailOtp} disabled={busy} className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
                    {busy ? "Sending…" : "Send code"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email-code">Enter code</Label>
                    <Input id="email-code" inputMode="numeric" value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} placeholder="123456" autoComplete="one-time-code" />
                    <p className="text-[10px] text-muted-foreground">Sent to {email}. <button type="button" className="text-primary hover:underline" onClick={() => { setEmailOtpSent(false); setEmailOtp(""); }}>Change email</button></p>
                  </div>
                  <Button type="button" onClick={verifyEmailOtp} disabled={busy} className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
                    {busy ? "Verifying…" : "Verify & Sign In"}
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="phone" className="space-y-4 pt-4">
              {!otpSent ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" />
                    <p className="text-[10px] text-muted-foreground">Include country code, e.g. +91 for India.</p>
                  </div>
                  <Button type="button" onClick={sendOtp} disabled={busy} className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
                    {busy ? "Sending…" : "Send OTP"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="otp">Enter OTP</Label>
                    <Input id="otp" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" autoComplete="one-time-code" />
                    <p className="text-[10px] text-muted-foreground">Sent to {phone}. <button type="button" className="text-primary hover:underline" onClick={() => { setOtpSent(false); setOtp(""); }}>Change number</button></p>
                  </div>
                  <Button type="button" onClick={verifyOtp} disabled={busy} className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
                    {busy ? "Verifying…" : "Verify & Sign In"}
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>

          <p className="text-sm text-center text-muted-foreground">
            Don't have an account? <Link to="/register" className="text-primary hover:underline">Register</Link>
          </p>

          <div className="pt-3 border-t border-border/60">
            <Link to="/admin-login" className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Perk({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary shrink-0">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/>
    </svg>
  );
}
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.5-.1-2.8.8-3.6.8-.8 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0-.1-2.5-.9-2.5-3.8zM14 5.4c.7-.8 1.1-1.9 1-3-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.9-1 2.9 1.1.1 2.2-.5 2.8-1.4z"/>
    </svg>
  );
}
