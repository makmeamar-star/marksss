import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

const STORAGE_KEY = "skp_age_gate_v1";
const CONSENT_VERSION = "v1-2026-05";

export function AgeGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  const accept = async () => {
    localStorage.setItem(STORAGE_KEY, CONSENT_VERSION);
    setOpen(false);
    // Best-effort log if signed in; ignore errors
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        await supabase.rpc("log_consent", {
          _type: "AGE_18",
          _version: CONSENT_VERSION,
          _ua: navigator.userAgent.slice(0, 500),
        });
      }
    } catch {}
  };

  const leave = () => {
    window.location.href = "https://www.google.com";
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl">Age verification</h2>
            <p className="text-xs text-muted-foreground">SattaKing Pro is for adults only</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          You must be <strong className="text-foreground">18 years or older</strong> to use this site. By continuing you confirm you meet the age requirement and accept our{" "}
          <Link to="/terms" className="text-primary">Terms</Link>,{" "}
          <Link to="/privacy" className="text-primary">Privacy Policy</Link>, and{" "}
          <Link to="/responsible-gaming" className="text-primary">Responsible Gaming</Link> guidelines.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={leave}>I am under 18</Button>
          <Button onClick={accept}>I am 18+ — Enter</Button>
        </div>
      </div>
    </div>
  );
}
