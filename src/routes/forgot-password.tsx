import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — SattaKing Pro" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const sendEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Enter a valid email");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Recovery email sent");
  };

  const sendPhoneOtp = async () => {
    if (!phone || phone.length < 8) return toast.error("Enter phone with country code, e.g. +91…");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) return toast.error(error.message);
    setOtpSent(true);
    toast.success("OTP sent");
  };

  const verifyPhoneOtp = async () => {
    if (!otp) return toast.error("Enter the OTP");
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Verified — set a new password");
    window.location.href = "/reset-password";
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-5 glass rounded-2xl p-6">
        <Link to="/login" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">Recover your account</h1>
          <p className="text-sm text-muted-foreground mt-1">Reset via email link or phone OTP.</p>
        </div>

        <Tabs defaultValue="email">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email"><Mail className="mr-2 h-3.5 w-3.5" />Email</TabsTrigger>
            <TabsTrigger value="phone"><Phone className="mr-2 h-3.5 w-3.5" />Phone</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="pt-4">
            {sent ? (
              <p className="text-sm text-muted-foreground">
                Recovery link sent to <span className="text-foreground">{email}</span>. Open it on this device to set a new password.
              </p>
            ) : (
              <form onSubmit={sendEmailReset} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Sending…" : "Send recovery email"}
                </Button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="phone" className="pt-4 space-y-4">
            {!otpSent ? (
              <>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <Button type="button" disabled={busy} onClick={sendPhoneOtp} className="w-full">
                  {busy ? "Sending…" : "Send OTP"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Enter OTP</Label>
                  <Input inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" />
                </div>
                <Button type="button" disabled={busy} onClick={verifyPhoneOtp} className="w-full">
                  {busy ? "Verifying…" : "Verify & continue"}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
