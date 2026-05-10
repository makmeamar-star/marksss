import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Crown, Medal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — SattaKing Pro" },
      { name: "description", content: "Top winners on SattaKing Pro — daily, weekly, monthly." },
    ],
  }),
  component: LeaderboardPage,
});

type Period = "today_won" | "week_won" | "month_won";

function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("today_won");
  const me = useAuthStore((s) => s.user?.id);

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard_winnings")
        .select("user_id, username, today_won, week_won, month_won")
        .order(period, { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).filter((r: any) => r[period] && Number(r[period]) > 0);
    },
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" /> Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground">Biggest winners across all markets.</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="bg-surface border border-border/60">
            <TabsTrigger value="today_won">Today</TabsTrigger>
            <TabsTrigger value="week_won">Week</TabsTrigger>
            <TabsTrigger value="month_won">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="glass rounded-xl p-4">
        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
        {data && data.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No winners yet — be the first!</p>
        )}
        <ol className="space-y-1.5">
          {data?.map((row: any, i: number) => (
            <li
              key={row.user_id}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 border ${
                row.user_id === me
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/40 bg-surface/40"
              }`}
            >
              <span className="w-7 text-center font-mono font-bold">
                {i === 0 ? <Crown className="h-5 w-5 text-yellow-400 inline" /> :
                 i === 1 ? <Medal className="h-5 w-5 text-zinc-300 inline" /> :
                 i === 2 ? <Medal className="h-5 w-5 text-amber-700 inline" /> :
                 `#${i + 1}`}
              </span>
              <span className="flex-1 font-medium truncate">
                {row.username}
                {row.user_id === me && <span className="text-[10px] ml-2 text-primary">YOU</span>}
              </span>
              <span className="font-mono text-emerald-400">
                ₹{Number(row[period]).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
