import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Bet, BetStatus, Market, MarketResult, ResultStatus, SessionType, BetType, Day } from "@/lib/types";
import { computeIsOpen, todayIST } from "@/lib/marketTime";
import { useAuthStore } from "@/stores/authStore";

const defaultPayouts = {
  single: 9, jodi: 90, singlePana: 150, doublePana: 300,
  triplePana: 600, halfSangam: 1000, fullSangam: 10000,
};

function rowToMarket(r: any): Market {
  const p = r.payouts ?? {};
  return {
    id: r.id,
    name: r.name,
    displayName: r.display_name,
    openTime: r.open_time,
    closeTime: r.close_time,
    resultTime: r.result_time,
    days: (r.days ?? []) as Day[],
    status: r.status,
    isOpen: computeIsOpen({
      openTime: r.open_time, closeTime: r.close_time,
      days: r.days, status: r.status,
    }),
    isCore: !!r.is_core,
    minBet: Number(r.min_bet ?? 10),
    maxBet: Number(r.max_bet ?? 10000),
    payouts: { ...defaultPayouts, ...p },
  };
}

function rowToResult(r: any): MarketResult {
  return {
    marketId: r.market_id,
    sessionDate: r.session_date,
    openPana: r.open_pana ?? undefined,
    openDigit: r.open_digit ?? undefined,
    closePana: r.close_pana ?? undefined,
    closeDigit: r.close_digit ?? undefined,
    jodi: r.jodi ?? undefined,
    status: r.status as ResultStatus,
    declaredAt: r.declared_at ?? undefined,
  };
}

function rowToBet(r: any): Bet {
  return {
    id: r.id,
    userId: r.user_id,
    marketId: r.market_id,
    sessionDate: r.session_date,
    session: r.session as SessionType,
    betType: r.bet_type as BetType,
    betNumber: r.bet_number,
    amount: Number(r.amount),
    payout: Number(r.payout),
    status: r.status as BetStatus,
    winAmount: r.win_amount != null ? Number(r.win_amount) : undefined,
    createdAt: r.created_at,
    settledAt: r.settled_at ?? undefined,
  };
}

/* ---------------- Markets ---------------- */
export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .order("display_name");
      if (error) throw error;
      return (data ?? []).map(rowToMarket);
    },
    // Markets rarely change. Cache aggressively but keep isOpen fresh
    // through the periodic refetch.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
}

/* ---------------- Results ---------------- */
export function useResultsForDate(date: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["results", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_results")
        .select("*")
        .eq("session_date", date);
      if (error) throw error;
      return (data ?? []).map(rowToResult);
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`results:${date}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_results", filter: `session_date=eq.${date}` },
        () => qc.invalidateQueries({ queryKey: ["results", date] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [date, qc]);

  return q;
}

export function useLatestResultsPerMarket(lookbackDays = 30) {
  return useQuery({
    queryKey: ["latest-results-per-market", lookbackDays],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - lookbackDays);
      const { data, error } = await supabase
        .from("market_results")
        .select("*")
        .eq("status", "DECLARED")
        .gte("session_date", from.toISOString().slice(0, 10))
        .order("session_date", { ascending: false });
      if (error) throw error;
      const map: Record<string, MarketResult> = {};
      for (const r of data ?? []) {
        if (!map[r.market_id]) map[r.market_id] = rowToResult(r);
      }
      return map;
    },
    staleTime: 60_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

export function useResultsRange(days = 14) {
  return useQuery({
    queryKey: ["results-range", days],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - days);
      const { data, error } = await supabase
        .from("market_results")
        .select("*")
        .gte("session_date", from.toISOString().slice(0, 10))
        .order("session_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToResult);
    },
    staleTime: 60_000,
  });
}

/* ---------------- Bets ---------------- */
export function useMyBets() {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["my-bets", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map(rowToBet);
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`bets:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["my-bets", userId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  return q;
}

/* ---------------- Place bets RPC ---------------- */
export interface PlaceBetItem {
  session: SessionType;
  bet_type: BetType;
  bet_number: string;
  amount: number;
  payout: number;
}

export async function placeBets(marketId: string, items: PlaceBetItem[]) {
  const { data, error } = await supabase.rpc("place_bets", {
    _market_id: marketId,
    _session_date: todayIST(),
    _items: items as any,
  });
  if (error) throw new Error(humanizeError(error.message));
  return data as { placedCount: number; totalAmount: number; newBalance: number; betIds: string[] };
}

function humanizeError(msg: string): string {
  if (msg.includes("INSUFFICIENT_BALANCE")) return "Insufficient balance.";
  if (msg.includes("OPEN_SESSION_CLOSED")) return "Open session is closed.";
  if (msg.includes("CLOSE_SESSION_CLOSED")) return "Close session is closed.";
  if (msg.includes("MARKET_SUSPENDED")) return "Market is currently suspended.";
  if (msg.includes("INVALID_PANA")) return "Invalid pana number.";
  if (msg.includes("PANA_TYPE_MISMATCH")) return "Pana type doesn't match the bet category.";
  if (msg.includes("INVALID_AMOUNT")) return "Bet amount is outside allowed range.";
  if (msg.includes("AUTH_REQUIRED")) return "Please log in.";
  return msg.replace(/^.*?:\s*/, "");
}
