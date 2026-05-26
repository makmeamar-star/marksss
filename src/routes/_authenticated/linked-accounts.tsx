import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link2, Unlink, Mail, Phone, Chrome, Apple } from "lucide-react";

export const Route = createFileRoute("/_authenticated/linked-accounts")({
  head: () => ({ meta: [{ title: "Linked Accounts — SattaKing Pro" }] }),
  component: LinkedAccountsPage,
});

type Identity = {
  id: string;
  provider: string;
  identity_data?: Record<string, any> | null;
};

function LinkedAccountsPage() {
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);

  // Email link
  const [newEmail, setNewEmail] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");

  // Phone link
  const [newPhone, setNewPhone] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.getUserIdentities();
    if (!error && data) setIdentities((data.identities ?? []) as Identity[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (!user) return null;

  const has = (p: string) => identities.some((i) => i.provider === p);

  const linkOAuth = async (provider: "google" | "apple") => {
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/profile/linked-accounts`,
      });
      if (result.error) throw new Error(result.error.message ?? "OAuth failed");
      // Browser will redirect; nothing else to do
    } catch (e: any) {
      toast.error(e?.message ?? `Failed to link ${provider}`);
    }
  };

  const unlinkProvider = async (identity: Identity) => {
    if (identities.length <= 1) {
      toast.error("You must keep at least one sign-in method.");
      return;
    }
    const { error } = await supabase.auth.unlinkIdentity(identity as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Unlinked ${identity.provider}`);
    await load();
  };

  const sendEmailOtp = async () => {
    if (!newEmail) return toast.error("Enter an email");
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) return toast.error(error.message);
    setEmailOtpSent(true);
    toast.success("OTP sent to new email — also confirm via current email if prompted.");
  };

  const verifyEmailOtp = async () => {
    const { error } = await supabase.auth.verifyOtp({
      email: newEmail,
      token: emailOtp,
      type: "email_change",
    });
    if (error) return toast.error(error.message);
    toast.success("Email linked!");
    setEmailOtpSent(false);
    setNewEmail("");
    setEmailOtp("");
    await load();
    await refreshProfile();
  };

  const sendPhoneOtp = async () => {
    if (!newPhone) return toast.error("Enter a phone number");
    const { error } = await supabase.auth.updateUser({ phone: newPhone });
    if (error) return toast.error(error.message);
    setPhoneOtpSent(true);
    toast.success("OTP sent via SMS");
  };

  const verifyPhoneOtp = async () => {
    const { error } = await supabase.auth.verifyOtp({
      phone: newPhone,
      token: phoneOtp,
      type: "phone_change",
    });
    if (error) return toast.error(error.message);
    toast.success("Phone linked!");
    setPhoneOtpSent(false);
    setNewPhone("");
    setPhoneOtp("");
    await load();
    await refreshProfile();
  };

  const providerIcon = (p: string) => {
    if (p === "google") return <Chrome className="h-4 w-4" />;
    if (p === "apple") return <Apple className="h-4 w-4" />;
    if (p === "phone") return <Phone className="h-4 w-4" />;
    return <Mail className="h-4 w-4" />;
  };

  const providerLabel = (p: string) => {
    if (p === "email") return "Email & password";
    return p.charAt(0).toUpperCase() + p.slice(1);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold">Linked accounts</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to the same account using any of these methods. Adding a method here keeps everything (balance,
          bets, KYC) on one account instead of creating a duplicate.
        </p>
      </header>

      {/* Current identities */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Currently linked</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : identities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No identities found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {identities.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {providerIcon(i.provider)}
                  <div>
                    <div className="font-medium">{providerLabel(i.provider)}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.identity_data?.email ?? i.identity_data?.phone ?? i.identity_data?.sub ?? "—"}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkProvider(i)}
                  disabled={identities.length <= 1}
                  title={identities.length <= 1 ? "Keep at least one sign-in method" : "Unlink"}
                >
                  <Unlink className="h-4 w-4 mr-1" /> Unlink
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* OAuth */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Social sign-in</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => linkOAuth("google")} disabled={has("google")}>
            <Chrome className="h-4 w-4 mr-2" />
            {has("google") ? "Google linked" : "Link Google"}
            {has("google") && <Badge variant="secondary" className="ml-2">✓</Badge>}
          </Button>
          <Button variant="outline" onClick={() => linkOAuth("apple")} disabled={has("apple")}>
            <Apple className="h-4 w-4 mr-2" />
            {has("apple") ? "Apple linked" : "Link Apple"}
            {has("apple") && <Badge variant="secondary" className="ml-2">✓</Badge>}
          </Button>
        </div>
      </section>

      {/* Email link */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4" /> Link a different email
        </h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            type="email"
            placeholder="you@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={emailOtpSent}
          />
          <Button onClick={sendEmailOtp} disabled={emailOtpSent || !newEmail}>
            Send OTP
          </Button>
        </div>
        {emailOtpSent && (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input placeholder="6-digit code" value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} />
            <Button onClick={verifyEmailOtp} disabled={emailOtp.length < 6}>
              <Link2 className="h-4 w-4 mr-1" /> Verify & link
            </Button>
          </div>
        )}
      </section>

      {/* Phone link */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Phone className="h-4 w-4" /> Link a phone number
        </h2>
        <p className="text-xs text-muted-foreground">
          Use international format (e.g. +14155551234). Requires SMS provider to be configured.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Label htmlFor="phone" className="sr-only">Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+14155551234"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            disabled={phoneOtpSent}
          />
          <Button onClick={sendPhoneOtp} disabled={phoneOtpSent || !newPhone}>
            Send OTP
          </Button>
        </div>
        {phoneOtpSent && (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input placeholder="6-digit code" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} />
            <Button onClick={verifyPhoneOtp} disabled={phoneOtp.length < 6}>
              <Link2 className="h-4 w-4 mr-1" /> Verify & link
            </Button>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Note: When you sign up with Google or Apple using the same verified email as an existing account, accounts are
        merged automatically. Phone numbers must be linked manually from this page while signed in.
      </p>
    </div>
  );
}
