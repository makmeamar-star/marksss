import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Share2, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({ meta: [{ title: "Refer & Earn — SattaKing Pro" }] }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile-ref", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code, referred_by, total_deposit")
        .eq("user_id", me!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: refs } = useQuery({
    queryKey: ["my-referrals", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("referee_id, signup_at, first_deposit_at, signup_bonus_paid, lifetime_commission")
        .eq("referrer_id", me!.id)
        .order("signup_at", { ascending: false });
      return data ?? [];
    },
  });

  const apply = useMutation({
    mutationFn: async (c: string) => {
      const { data, error } = await supabase.rpc("apply_referral_code", { _code: c.toUpperCase().trim() });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Referral code applied — your friend earns ₹50 on your first ₹500+ deposit");
      setCode("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message.replace(/^.*?:\s*/, "")),
  });

  const inviteUrl = profile?.referral_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${profile.referral_code}`
    : "";

  const totalEarned = (refs ?? []).reduce(
    (s, r) => s + Number(r.signup_bonus_paid) + Number(r.lifetime_commission),
    0,
  );
  const activated = (refs ?? []).filter((r) => r.first_deposit_at).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> Refer & Earn
        </h1>
        <p className="text-sm text-muted-foreground">
          Get ₹50 when your friend deposits ₹500+, plus 2% lifetime commission on their deposits.
        </p>
      </header>

      <div className="grid sm:grid-cols-3 gap-3">
        <Kpi label="Friends joined" value={String(refs?.length ?? 0)} />
        <Kpi label="Activated" value={String(activated)} accent />
        <Kpi label="Total earned" value={`₹${totalEarned.toLocaleString("en-IN")}`} positive />
      </div>

      <div className="glass-gold rounded-xl p-5 space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your code</div>
        <div className="flex items-center gap-2">
          <div className="font-mono text-3xl font-bold text-primary text-glow-gold">
            {profile?.referral_code ?? "…"}
          </div>
          {profile?.referral_code && (
            <Button size="icon" variant="ghost" onClick={() => {
              navigator.clipboard.writeText(profile.referral_code!);
              toast.success("Code copied");
            }}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Input value={inviteUrl} readOnly className="font-mono text-xs" />
          <Button variant="outline" onClick={() => {
            navigator.clipboard.writeText(inviteUrl);
            toast.success("Link copied");
          }}><Copy className="h-4 w-4" /></Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button variant="outline" onClick={() => {
              navigator.share?.({ title: "SattaKing Pro", text: "Join me on SattaKing Pro!", url: inviteUrl });
            }}><Share2 className="h-4 w-4" /></Button>
          )}
        </div>
      </div>

      {!profile?.referred_by && (profile?.total_deposit ?? 0) === 0 && (
        <div className="glass rounded-xl p-5 space-y-3">
          <Label>Have a referral code?</Label>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FRIEND CODE"
              maxLength={16}
              className="font-mono uppercase"
            />
            <Button onClick={() => apply.mutate(code)} disabled={!code || apply.isPending}>
              {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Apply before your first deposit. Cannot be changed later.</p>
        </div>
      )}

      <div className="glass rounded-xl p-4">
        <h3 className="font-display text-lg font-bold mb-3">My referrals</h3>
        {(!refs || refs.length === 0) && (
          <p className="text-sm text-muted-foreground py-6 text-center">No friends joined yet — share your code!</p>
        )}
        {refs && refs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Joined</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-right p-2">Earned</th>
                </tr>
              </thead>
              <tbody>
                {refs.map((r) => (
                  <tr key={r.referee_id} className="border-t border-border/40">
                    <td className="p-2 font-mono text-xs">{r.referee_id.slice(0, 8)}…</td>
                    <td className="p-2 text-xs text-muted-foreground">{new Date(r.signup_at).toLocaleDateString()}</td>
                    <td className="p-2 text-xs">
                      {r.first_deposit_at
                        ? <span className="text-emerald-400">Activated</span>
                        : <span className="text-muted-foreground">Pending deposit</span>}
                    </td>
                    <td className="p-2 text-right font-mono text-emerald-400">
                      ₹{(Number(r.signup_bonus_paid) + Number(r.lifetime_commission)).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent, positive }: { label: string; value: string; accent?: boolean; positive?: boolean }) {
  return (
    <div className={`${accent ? "glass-gold" : "glass"} rounded-xl p-4`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono text-2xl font-bold mt-1 ${accent ? "text-primary" : positive ? "text-emerald-400" : ""}`}>
        {value}
      </div>
    </div>
  );
}
