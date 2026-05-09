import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Crown, Gift, ShieldCheck, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create your account — SattaKing Pro" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", username: "", email: "", phone: "", password: "", confirm: "", referral: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const pwdScore = (() => {
    const p = form.password;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^a-zA-Z0-9]/.test(p)) s++;
    return s;
  })();
  const scoreColor = ["bg-danger", "bg-danger", "bg-warning", "bg-warning", "bg-success"][pwdScore];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password) return toast.error("Fill the required fields");
    if (form.password !== form.confirm) return toast.error("Passwords do not match");
    if (pwdScore < 3) return toast.error("Choose a stronger password");
    if (!agreed) return toast.error("Please accept the Terms & Conditions");
    setBusy(true);
    try {
      await register({ username: form.username, email: form.email, phone: form.phone, password: form.password });
      toast.success(`Welcome ${form.username}! ₹1,000 bonus credited.`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
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
        <div className="relative space-y-5">
          <h2 className="font-display text-4xl font-bold">
            Get a <span className="text-primary text-glow-gold">₹1,000</span> welcome bonus
          </h2>
          <ul className="space-y-3 text-muted-foreground">
            <Perk icon={<Gift />} text="₹1,000 instantly credited on signup" />
            <Perk icon={<Wallet />} text="Fast UPI deposits & withdrawals" />
            <Perk icon={<ShieldCheck />} text="Bank-grade security & 2FA on accounts" />
          </ul>
        </div>
        <p className="text-xs text-muted-foreground/60 relative">Prototype · demo data only.</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={submit} className="w-full max-w-md space-y-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Create account</h1>
            <p className="text-sm text-muted-foreground mt-1">Takes less than a minute.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" v={form.name} onChange={set("name")} placeholder="Rohan Sharma" />
            <Field label="Username *" v={form.username} onChange={set("username")} placeholder="rohan99" />
          </div>
          <Field label="Email *" v={form.email} onChange={set("email")} placeholder="you@example.com" type="email" />
          <Field label="Mobile (10 digits)" v={form.phone} onChange={set("phone")} placeholder="9876543210" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Password *" v={form.password} onChange={set("password")} type="password" />
            <Field label="Confirm *" v={form.confirm} onChange={set("confirm")} type="password" />
          </div>
          <div className="flex gap-1">
            {[0,1,2,3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded ${i < pwdScore ? scoreColor : "bg-border"}`} />
            ))}
          </div>

          <Field label="Referral code (optional)" v={form.referral} onChange={set("referral")} placeholder="ABCD12" />

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
            <span>I agree to the <span className="text-primary">Terms & Conditions</span> and confirm I am 18+.</span>
          </label>

          <Button type="submit" disabled={busy} className="w-full bg-gradient-gold text-background font-bold hover:opacity-90">
            {busy ? "Creating account…" : "Create Account"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Already a player? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, v, onChange, ...rest }: { label: string; v: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={onChange} {...rest} />
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
