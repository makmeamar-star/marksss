import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — SattaKing Pro" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase puts the recovery token in the URL hash. Wait for the session
  // to be exchanged (onAuthStateChange fires PASSWORD_RECOVERY), or use the
  // already-active session from phone-OTP recovery.
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted && data.session) setReady(true);
    };
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    const timeout = setTimeout(() => {
      if (mounted && !ready) setError("This link is invalid or expired. Request a new recovery link.");
    }, 2500);
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (upErr) return toast.error(upErr.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 glass rounded-2xl p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a new password for your account.
          </p>
        </div>
        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-danger">{error}</p>
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">Request a new link →</Link>
          </div>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground">Verifying recovery link…</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>New password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label>Confirm password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Updating…" : "Update password"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
