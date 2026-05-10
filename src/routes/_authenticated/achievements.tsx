import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Target, Flame, Sparkles, Users, Crown, CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({ meta: [{ title: "Achievements — SattaKing Pro" }] }),
  component: AchievementsPage,
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy, target: Target, flame: Flame, sparkles: Sparkles, users: Users, crown: Crown,
};

function AchievementsPage() {
  const me = useAuthStore((s) => s.user?.id);

  const { data } = useQuery({
    queryKey: ["achievements", me],
    enabled: !!me,
    queryFn: async () => {
      const [cat, mine] = await Promise.all([
        supabase.from("achievements").select("*").eq("active", true).order("sort_order"),
        supabase.from("user_achievements").select("code, unlocked_at").eq("user_id", me!),
      ]);
      const unlocked = new Set((mine.data ?? []).map((u: any) => u.code));
      const unlockedAt = Object.fromEntries((mine.data ?? []).map((u: any) => [u.code, u.unlocked_at]));
      return (cat.data ?? []).map((a: any) => ({ ...a, unlocked: unlocked.has(a.code), unlockedAt: unlockedAt[a.code] }));
    },
  });

  const unlockedCount = data?.filter((a) => a.unlocked).length ?? 0;
  const total = data?.length ?? 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
      <header>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-7 w-7 text-primary" /> Achievements
        </h1>
        <p className="text-sm text-muted-foreground">
          Unlocked {unlockedCount} of {total} badges.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        {data?.map((a) => {
          const Icon = ICONS[a.icon] ?? Trophy;
          return (
            <div
              key={a.code}
              className={`rounded-xl p-4 border ${
                a.unlocked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/40 bg-surface/40 opacity-70"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${
                  a.unlocked ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"
                }`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold truncate">{a.title}</h3>
                    {a.unlocked
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      : <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-primary font-mono">+₹{Number(a.reward_amount).toLocaleString("en-IN")}</span>
                    {a.unlocked && a.unlockedAt && (
                      <span className="text-muted-foreground">
                        {new Date(a.unlockedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
