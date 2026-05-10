import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Flame, Gift, Sparkles, CheckCircle2, Loader2, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { RangoliDivider } from "@/components/RangoliDivider";

export const Route = createFileRoute("/_authenticated/rewards")({
  head: () => ({ meta: [{ title: "Daily Rewards — SattaKing Pro" }] }),
  component: RewardsPage,
});

type Streak = {
  current_streak: number;
  longest_streak: number;
  last_claim_date: string | null;
  total_claimed: number;
};
type Mission = {
  id: string;
  code: string;
  title: string;
  description: string;
  target: number;
  reward_amount: number;
};
type UserMission = {
  mission_code: string;
  progress: number;
  claimed_at: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function RewardsPage() {
  const refreshUser = useAuthStore((s) => s.refreshProfile);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [userMissions, setUserMissions] = useState<UserMission[]>([]);
  const [spunToday, setSpunToday] = useState<{ prize_amount: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [spinAngle, setSpinAngle] = useState(0);

  async function load() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const today = todayISO();
    const [s, m, um, sp] = await Promise.all([
      supabase.from("user_streaks").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("daily_missions").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("user_missions").select("mission_code,progress,claimed_at").eq("user_id", uid).eq("mission_date", today),
      supabase.from("daily_spins").select("prize_amount").eq("user_id", uid).eq("spin_date", today).maybeSingle(),
    ]);
    setStreak(s.data as Streak | null);
    setMissions((m.data ?? []) as Mission[]);
    setUserMissions((um.data ?? []) as UserMission[]);
    setSpunToday(sp.data as { prize_amount: number } | null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const claimedToday = streak?.last_claim_date === todayISO();
  const nextStreakReward = useMemo(() => {
    const next = (streak?.current_streak ?? 0) + (claimedToday ? 0 : 1);
    return Math.min(5 + (Math.max(next, 1) - 1) * 2, 50);
  }, [streak, claimedToday]);

  async function claimStreak() {
    setBusy("streak");
    const { data, error } = await supabase.rpc("claim_daily_streak");
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; reason?: string; reward?: number; streak?: number };
    if (!res.ok) { toast.info(res.reason === "already_claimed" ? "Already claimed today" : "Try again tomorrow"); return; }
    toast.success(`+₹${res.reward} · Day ${res.streak} streak!`);
    await Promise.all([load(), refreshUser?.()]);
  }

  async function spin() {
    if (spunToday) { toast.info("Come back tomorrow for another spin!"); return; }
    setBusy("spin");
    setSpinAngle((a) => a + 1440 + Math.floor(Math.random() * 360));
    const { data, error } = await supabase.rpc("spin_daily_wheel");
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; reason?: string; prize?: number };
    if (!res.ok) { toast.info("Already spun today"); await load(); return; }
    toast.success(`🎉 You won ₹${res.prize}!`);
    await Promise.all([load(), refreshUser?.()]);
  }

  async function claimMission(code: string) {
    setBusy(code);
    const { data, error } = await supabase.rpc("claim_mission", { p_code: code });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; reason?: string; reward?: number };
    if (!res.ok) { toast.info(res.reason ?? "Cannot claim"); return; }
    toast.success(`+₹${res.reward} mission reward!`);
    await Promise.all([load(), refreshUser?.()]);
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <div className="text-center">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-glow-diya">Daily Rewards</h1>
        <p className="font-devanagari text-saffron text-sm mt-1">रोज़ खेलो · रोज़ जीतो</p>
      </div>

      {/* STREAK */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 mandala-corner">
        <div className="p-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-india text-background shadow-lg">
              <Flame className="h-8 w-8" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Login Streak</div>
              <div className="font-display text-3xl font-bold">{streak?.current_streak ?? 0} <span className="text-base text-muted-foreground">days</span></div>
              <div className="text-xs text-muted-foreground">Best: {streak?.longest_streak ?? 0} · Earned ₹{streak?.total_claimed ?? 0}</div>
            </div>
          </div>
          <div className="flex-1 min-w-[180px]" />
          <Button
            disabled={loading || claimedToday || busy === "streak"}
            onClick={claimStreak}
            className="bg-gradient-gold text-background font-bold hover:opacity-90"
            size="lg"
          >
            {busy === "streak" ? <Loader2 className="h-4 w-4 animate-spin" /> :
              claimedToday ? <><CheckCircle2 className="mr-2 h-4 w-4"/> Claimed today</> :
              <>Claim ₹{nextStreakReward}</>}
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 px-6 pb-6">
          {Array.from({ length: 7 }).map((_, i) => {
            const day = i + 1;
            const reached = (streak?.current_streak ?? 0) >= day;
            return (
              <div key={i} className={`rounded-md py-2 text-center text-xs border ${reached ? "border-primary/60 bg-primary/15 text-primary" : "border-border/40 text-muted-foreground"}`}>
                Day {day}
              </div>
            );
          })}
        </div>
      </Card>

      <RangoliDivider label="Spin · चक्र" />

      {/* SPIN WHEEL */}
      <Card className="p-6 border-primary/30 bg-card text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <motion.div
              animate={{ rotate: spinAngle }}
              transition={{ duration: 2.5, ease: [0.2, 0.8, 0.2, 1] }}
              className="h-44 w-44 rounded-full border-4 border-primary/60 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.5)]"
              style={{
                background: "conic-gradient(from 0deg, hsl(var(--saffron)) 0 60deg, hsl(var(--primary)) 60deg 120deg, hsl(var(--henna)) 120deg 180deg, hsl(var(--maroon)) 180deg 240deg, hsl(var(--peacock)) 240deg 300deg, hsl(var(--primary)) 300deg 360deg)",
              }}
            >
              <div className="absolute inset-3 rounded-full bg-card grid place-items-center">
                <Gift className="h-10 w-10 text-primary" />
              </div>
            </motion.div>
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-[14px] border-l-transparent border-r-transparent border-t-primary" />
          </div>
          <div>
            <div className="font-display text-xl font-bold">Daily Lucky Spin</div>
            <p className="text-sm text-muted-foreground">Win up to ₹100 every day · one free spin</p>
          </div>
          <Button
            disabled={loading || !!spunToday || busy === "spin"}
            onClick={spin}
            size="lg"
            className="bg-gradient-india text-background font-bold hover:opacity-90"
          >
            {busy === "spin" ? <Loader2 className="h-4 w-4 animate-spin" /> :
              spunToday ? <>Won ₹{spunToday.prize_amount} today</> :
              <><Sparkles className="mr-2 h-4 w-4"/> Spin Now</>}
          </Button>
        </div>
      </Card>

      <RangoliDivider label="Missions · लक्ष्य" />

      {/* MISSIONS */}
      <div className="grid sm:grid-cols-2 gap-3">
        {missions.map((m) => {
          const um = userMissions.find((x) => x.mission_code === m.code);
          const progress = um?.progress ?? 0;
          const claimed = !!um?.claimed_at;
          const complete = progress >= m.target;
          return (
            <Card key={m.id} className="p-4 border-border/60 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <div className="font-semibold">{m.title}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{m.description}</div>
                </div>
                <Badge variant="outline" className="border-primary/40 text-primary">+₹{m.reward_amount}</Badge>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress}/{m.target}</span>
                  {claimed && <span className="text-primary">Claimed</span>}
                </div>
                <Progress value={Math.min(100, (progress / m.target) * 100)} />
              </div>
              <Button
                size="sm"
                disabled={!complete || claimed || busy === m.code}
                onClick={() => claimMission(m.code)}
                className="mt-3 w-full bg-gradient-gold text-background font-bold hover:opacity-90 disabled:opacity-50"
              >
                {busy === m.code ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  claimed ? "Reward claimed" : complete ? "Claim reward" : "In progress"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
