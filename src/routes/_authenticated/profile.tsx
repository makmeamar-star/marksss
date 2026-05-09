import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Copy, Shield, LogOut, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — SattaKing Pro" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [twoFA, setTwoFA] = useState(false);
  const [notifResults, setNotifResults] = useState(true);
  const [notifWins, setNotifWins] = useState(true);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
      <header>
        <h1 className="font-display text-3xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account, security, and preferences.</p>
      </header>

      {/* Identity */}
      <section className="glass rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-gold text-background font-display text-2xl font-bold">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-xl font-bold">{user.username}</div>
            <div className="text-sm text-muted-foreground truncate">{user.email}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">{user.role}</Badge>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">{user.status}</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-display text-lg font-bold">Contact</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
          </div>
        </div>
        <Button variant="outline" disabled={savingPhone} onClick={async () => {
          setSavingPhone(true);
          const { error } = await supabase.from("profiles").update({ phone }).eq("user_id", user.id);
          setSavingPhone(false);
          if (error) return toast.error(error.message);
          toast.success("Profile updated");
        }}>{savingPhone ? "Saving…" : "Save changes"}</Button>
      </section>

      {/* KYC */}
      <section className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">KYC Verification</h2>
          <Badge variant="outline" className="border-amber-500/40 text-amber-400">Pending</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Required before withdrawals over ₹10,000. Mock upload only.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <KycSlot label="Aadhaar" />
          <KycSlot label="PAN" />
        </div>
      </section>

      {/* Security */}
      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="font-display text-lg font-bold flex items-center gap-2"><Shield className="h-4 w-4" /> Security</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Two-factor authentication</div>
            <div className="text-xs text-muted-foreground">Add an extra layer using SMS OTP.</div>
          </div>
          <Switch checked={twoFA} onCheckedChange={(v) => { setTwoFA(v); toast.success(v ? "2FA enabled" : "2FA disabled"); }} />
        </div>
        <Button variant="outline" onClick={() => toast.success("Password reset email sent (mock)")}>Change password</Button>
      </section>

      {/* Preferences */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-display text-lg font-bold">Notification preferences</h2>
        <PrefRow label="Result declarations" checked={notifResults} onChange={setNotifResults} />
        <PrefRow label="Bet wins & losses" checked={notifWins} onChange={setNotifWins} />
      </section>

      {/* Referral */}
      <section className="glass-gold rounded-xl p-5">
        <h2 className="font-display text-lg font-bold">Referral code</h2>
        <p className="text-xs text-muted-foreground mb-3">Share this code, earn ₹100 per signup.</p>
        <div className="flex items-center gap-2">
          <code className="font-mono text-primary text-glow-gold text-xl tracking-widest">{user.referralCode}</code>
          <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(user.referralCode); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
        </div>
      </section>

      {/* Danger */}
      <section className="rounded-xl p-5 border border-destructive/30 space-y-3">
        <h2 className="font-display text-lg font-bold text-destructive">Danger zone</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={logout}><LogOut className="h-4 w-4 mr-1" /> Logout</Button>
          <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => toast.error("Account deletion is disabled in demo")}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete account
          </Button>
        </div>
      </section>
    </div>
  );
}

function KycSlot({ label }: { label: string }) {
  return (
    <button
      onClick={() => toast.success(`${label} uploaded (mock)`)}
      className="border border-dashed border-border/60 rounded-lg p-4 text-left hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center gap-2 text-sm font-medium"><Upload className="h-4 w-4" /> {label}</div>
      <div className="text-[11px] text-muted-foreground mt-1">PNG, JPG or PDF · Max 5 MB</div>
    </button>
  );
}

function PrefRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
