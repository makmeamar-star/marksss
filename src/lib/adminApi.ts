// Mock admin API layer — mirrors the REST shape that the Express backend will
// expose during Phase 5 handoff. Each function returns a Promise so the React
// Query usage stays identical when swapped to fetch().

import {
  isValidPana,
  digitFromPana,
  panaType,
  getSuggestedPanas,
  type PanaType,
} from "@/lib/panaChart";
import { resolveResult, settleBets, payoutFor } from "@/lib/settlement";
import type { Bet, Market, MarketResult, SessionType } from "@/lib/types";
import { useMarketStore } from "@/stores/marketStore";
import { useBetStore } from "@/stores/betStore";
import { useWalletStore } from "@/stores/walletStore";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuditStore } from "@/stores/auditStore";
import { useRealtimeStore } from "@/stores/realtimeStore";

const delay = (ms = 60) => new Promise<void>((r) => setTimeout(r, ms));

const todayStr = () => new Date().toISOString().slice(0, 10);

export interface PendingMarketRow {
  marketId: string;
  marketName: string;
  session: SessionType;
  resultTime: string;
  expectedAt: string;     // ISO
  overdueMinutes: number; // negative if not yet due
  totalBets: number;
  totalBetAmount: number;
  status: "PENDING" | "PARTIAL" | "DECLARED" | "SUSPENDED";
}

export interface DeclaredMarketRow {
  sessionId: string;
  marketId: string;
  marketName: string;
  session: SessionType;
  pana: string;
  digit: number;
  declaredAt: string;
  declaredBy: string;
  correctionWindowOpen: boolean;
  correctionRemainingMs: number;
}

export interface ImpactBetTypeRow {
  betType: string;
  count: number;
  amount: number;
  payout: number;
}

export interface ImpactPreview {
  winningBets: {
    count: number;
    amount: number;
    totalPayout: number;
    byType: ImpactBetTypeRow[];
  };
  losingBets: { count: number; amount: number };
  totalBets: number;
  totalBetAmount: number;
  netImpact: number;
  topWinners: { usernameMasked: string; amount: number }[];
  warning: null | "HIGH_PAYOUT" | "EXTREME_PAYOUT";
}

const CORRECTION_WINDOW_MS = 10 * 60 * 1000;

function maskUsername(u: string): string {
  if (u.length <= 4) return u[0] + "***" + u.slice(-1);
  return u.slice(0, 2) + "***" + u.slice(-2);
}

function timeOfToday(time: string, dateStr = todayStr()): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function sessionExpectedTime(market: Market, session: SessionType, dateStr: string): string {
  // Open session result usually expected ~30min after openTime closes;
  // we use openTime for OPEN, resultTime for CLOSE.
  const t = session === "OPEN" ? market.openTime : market.resultTime;
  return timeOfToday(t, dateStr).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────────────────────

export interface PanaValidation {
  valid: boolean;
  digit: number | null;
  type: PanaType | null;
  suggestions: string[];
  reason?: string;
}

export async function validatePana(pana: string): Promise<PanaValidation> {
  await delay(20);
  if (!/^\d{3}$/.test(pana)) {
    return {
      valid: false,
      digit: null,
      type: null,
      suggestions: [],
      reason: "Pana must be exactly 3 digits",
    };
  }
  const valid = isValidPana(pana);
  if (!valid) {
    return {
      valid: false,
      digit: digitFromPana(pana),
      type: panaType(pana),
      suggestions: getSuggestedPanas(pana),
      reason: `${pana} does not appear in the official pana chart`,
    };
  }
  return {
    valid: true,
    digit: digitFromPana(pana),
    type: panaType(pana),
    suggestions: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function pendingToday(): Promise<PendingMarketRow[]> {
  await delay();
  const { markets, results } = useMarketStore.getState();
  const bets = useBetStore.getState().bets;
  const date = todayStr();
  const now = Date.now();

  const rows: PendingMarketRow[] = [];
  for (const m of markets) {
    if (m.status === "SUSPENDED") continue;
    const r = results.find((x) => x.marketId === m.id && x.sessionDate === date);
    const sessions: SessionType[] = ["OPEN", "CLOSE"];
    for (const s of sessions) {
      const declared =
        r && (s === "OPEN" ? r.openPana : r.closePana) ? true : false;
      if (declared) continue;

      const expected = sessionExpectedTime(m, s, date);
      const expectedMs = new Date(expected).getTime();
      const sessionBets = bets.filter(
        (b) => b.marketId === m.id && b.sessionDate === date && b.session === s,
      );

      rows.push({
        marketId: m.id,
        marketName: m.displayName,
        session: s,
        resultTime: s === "OPEN" ? m.openTime : m.resultTime,
        expectedAt: expected,
        overdueMinutes: Math.floor((now - expectedMs) / 60_000),
        totalBets: sessionBets.length,
        totalBetAmount: sessionBets.reduce((acc, b) => acc + b.amount, 0),
        status:
          r && (s === "OPEN" ? r.closePana : r.openPana) ? "PARTIAL" : "PENDING",
      });
    }
  }

  rows.sort((a, b) => {
    // Overdue first, then by expectedAt
    if (a.overdueMinutes >= 0 && b.overdueMinutes < 0) return -1;
    if (b.overdueMinutes >= 0 && a.overdueMinutes < 0) return 1;
    return new Date(a.expectedAt).getTime() - new Date(b.expectedAt).getTime();
  });
  return rows;
}

export async function declaredToday(): Promise<DeclaredMarketRow[]> {
  await delay();
  const { markets, results } = useMarketStore.getState();
  const date = todayStr();
  const now = Date.now();
  const out: DeclaredMarketRow[] = [];

  for (const r of results) {
    if (r.sessionDate !== date) continue;
    const m = markets.find((x) => x.id === r.marketId);
    if (!m) continue;

    const push = (session: SessionType, pana?: string, digit?: number) => {
      if (!pana || digit === undefined) return;
      const declaredAt = r.declaredAt ?? new Date().toISOString();
      const elapsed = now - new Date(declaredAt).getTime();
      const remain = Math.max(0, CORRECTION_WINDOW_MS - elapsed);
      out.push({
        sessionId: `${r.marketId}-${date}-${session}`,
        marketId: r.marketId,
        marketName: m.displayName,
        session,
        pana,
        digit,
        declaredAt,
        declaredBy: useAuthStore.getState().user?.email ?? "admin@sattaking.local",
        correctionWindowOpen: remain > 0,
        correctionRemainingMs: remain,
      });
    };
    push("OPEN", r.openPana, r.openDigit);
    push("CLOSE", r.closePana, r.closeDigit);
  }
  out.sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime());
  return out;
}

export async function getMarketSessionInfo(marketId: string, session: SessionType, date: string) {
  await delay(20);
  const { markets, results } = useMarketStore.getState();
  const market = markets.find((m) => m.id === marketId);
  if (!market) return null;
  const r = results.find((x) => x.marketId === marketId && x.sessionDate === date);
  const bets = useBetStore.getState().bets.filter(
    (b) => b.marketId === marketId && b.sessionDate === date && b.session === session,
  );
  const declared = r && (session === "OPEN" ? r.openPana : r.closePana);
  return {
    market,
    result: r,
    declared: !!declared,
    pana: session === "OPEN" ? r?.openPana : r?.closePana,
    digit: session === "OPEN" ? r?.openDigit : r?.closeDigit,
    totalBets: bets.length,
    totalBetAmount: bets.reduce((s, b) => s + b.amount, 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Impact preview
// ─────────────────────────────────────────────────────────────────────────────

export async function impactPreview(input: {
  marketId: string;
  sessionDate: string;
  session: SessionType;
  pana: string;
}): Promise<ImpactPreview> {
  await delay(120);
  const { markets, results } = useMarketStore.getState();
  const market = markets.find((m) => m.id === input.marketId);
  if (!market) throw new Error("Market not found");

  const existing = results.find(
    (x) => x.marketId === input.marketId && x.sessionDate === input.sessionDate,
  );
  const resolved = resolveResult({
    openPana: input.session === "OPEN" ? input.pana : existing?.openPana,
    closePana: input.session === "CLOSE" ? input.pana : existing?.closePana,
  });

  const allBets = useBetStore.getState().bets.filter(
    (b) =>
      b.marketId === input.marketId &&
      b.sessionDate === input.sessionDate &&
      b.status === "PENDING",
  );
  const settled = settleBets(allBets, resolved);

  const byTypeMap = new Map<string, ImpactBetTypeRow>();
  let topWinners: { usernameMasked: string; amount: number }[] = [];
  for (const b of settled.settled) {
    const won = b.status === "WON";
    if (!won) continue;
    const row = byTypeMap.get(b.betType) ?? {
      betType: b.betType, count: 0, amount: 0, payout: 0,
    };
    row.count++;
    row.amount += b.amount;
    row.payout += b.winAmount ?? 0;
    byTypeMap.set(b.betType, row);
    topWinners.push({ usernameMasked: maskUsername(b.userId.slice(0, 8)), amount: b.winAmount ?? 0 });
  }
  topWinners = topWinners.sort((a, b) => b.amount - a.amount).slice(0, 5);

  const totalBetAmount = settled.totalBet;
  const totalPayout = settled.totalPayout;
  const ratio = totalBetAmount === 0 ? 0 : totalPayout / totalBetAmount;
  const warning =
    ratio > 5 ? "EXTREME_PAYOUT" : ratio > 1.5 ? "HIGH_PAYOUT" : null;

  return {
    winningBets: {
      count: settled.winnersCount,
      amount: Array.from(byTypeMap.values()).reduce((s, r) => s + r.amount, 0),
      totalPayout,
      byType: Array.from(byTypeMap.values()),
    },
    losingBets: {
      count: settled.losersCount,
      amount: totalBetAmount - Array.from(byTypeMap.values()).reduce((s, r) => s + r.amount, 0),
    },
    totalBets: allBets.length,
    totalBetAmount,
    netImpact: totalBetAmount - totalPayout,
    topWinners,
    warning,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Declarations
// ─────────────────────────────────────────────────────────────────────────────

let inFlight: Promise<unknown> | null = null;

export interface DeclareInput {
  marketId: string;
  sessionDate: string;
  session: SessionType;
  pana: string;
  confirmationText: string;
}

export interface DeclareResultOk {
  ok: true;
  sessionId: string;
  digit: number;
  jodi?: string;
  settledBets: number;
  totalPayout: number;
}
export interface DeclareResultErr {
  ok: false;
  error: string;
  code: "INVALID_PANA" | "MARKET_NOT_FOUND" | "ALREADY_DECLARED" | "BAD_CONFIRMATION" | "SUSPENDED";
}

export async function declareResult(
  input: DeclareInput,
): Promise<DeclareResultOk | DeclareResultErr> {
  // double-submit guard
  if (inFlight) await inFlight;
  let resolveGuard!: () => void;
  inFlight = new Promise<void>((r) => (resolveGuard = r));

  try {
    await delay(180);

    if (input.confirmationText !== "CONFIRM") {
      return { ok: false, error: "Type CONFIRM to proceed", code: "BAD_CONFIRMATION" };
    }
    if (!isValidPana(input.pana)) {
      return { ok: false, error: "Invalid pana", code: "INVALID_PANA" };
    }
    const market = useMarketStore.getState().markets.find((m) => m.id === input.marketId);
    if (!market) return { ok: false, error: "Market not found", code: "MARKET_NOT_FOUND" };
    if (market.status === "SUSPENDED")
      return { ok: false, error: "Market is suspended today", code: "SUSPENDED" };

    const existing = useMarketStore.getState().results.find(
      (r) => r.marketId === input.marketId && r.sessionDate === input.sessionDate,
    );
    if (existing && (input.session === "OPEN" ? existing.openPana : existing.closePana)) {
      return { ok: false, error: "Result already declared for this session", code: "ALREADY_DECLARED" };
    }

    const digit = digitFromPana(input.pana);
    const merged: MarketResult = {
      marketId: input.marketId,
      sessionDate: input.sessionDate,
      openPana: input.session === "OPEN" ? input.pana : existing?.openPana,
      openDigit: input.session === "OPEN" ? digit : existing?.openDigit,
      closePana: input.session === "CLOSE" ? input.pana : existing?.closePana,
      closeDigit: input.session === "CLOSE" ? digit : existing?.closeDigit,
      status: "DECLARED",
      declaredAt: new Date().toISOString(),
    };
    if (merged.openDigit !== undefined && merged.closeDigit !== undefined) {
      merged.jodi = `${merged.openDigit}${merged.closeDigit}`;
    }
    useMarketStore.getState().upsertResult(merged);

    const settledRes = settleSessionBets(input.marketId, input.sessionDate, merged);

    // audit + activity
    const adminEmail = useAuthStore.getState().user?.email ?? "admin@sattaking.local";
    const adminId = useAuthStore.getState().user?.id ?? "system";
    useAuditStore.getState().push({
      adminId, adminEmail,
      action: "DECLARED",
      marketId: input.marketId, marketName: market.displayName,
      session: input.session, sessionDate: input.sessionDate,
      newPana: input.pana,
      betsAffected: settledRes.bets,
      payout: settledRes.payout,
    });
    useRealtimeStore.getState().emit(
      "result:declared",
      `✅ ${market.displayName} ${input.session} declared — Pana ${input.pana}, Digit ${digit}`,
    );
    if (settledRes.bets > 0) {
      useRealtimeStore.getState().emit(
        "settlement:complete",
        `💰 ${settledRes.bets} bets settled for ${market.displayName}`,
      );
    }
    return {
      ok: true,
      sessionId: `${input.marketId}-${input.sessionDate}-${input.session}`,
      digit,
      jodi: merged.jodi,
      settledBets: settledRes.bets,
      totalPayout: settledRes.payout,
    };
  } finally {
    resolveGuard();
    inFlight = null;
  }
}

/** Settle pending bets for a session against the merged declared result. */
function settleSessionBets(
  marketId: string,
  sessionDate: string,
  merged: MarketResult,
): { bets: number; payout: number; winners: number } {
  const bets = useBetStore.getState().bets.filter(
    (b) => b.marketId === marketId && b.sessionDate === sessionDate && b.status === "PENDING",
  );
  if (bets.length === 0) return { bets: 0, payout: 0, winners: 0 };

  const settled = settleBets(bets, merged);
  // mutate bets in store
  const allBets = useBetStore.getState().bets;
  const nextBets: Bet[] = allBets.map((b) => {
    const s = settled.settled.find((x) => x.id === b.id);
    return s ? (s as Bet) : b;
  });
  useBetStore.setState({ bets: nextBets });

  // per-user wallet credits + notifications + realtime
  const auth = useAuthStore.getState();
  const wallet = useWalletStore.getState();
  const notif = useNotificationStore.getState();
  const realtime = useRealtimeStore.getState();

  let winners = 0;
  for (const b of settled.settled) {
    if (b.status === "WON") {
      winners++;
      if (auth.user?.id === b.userId) {
        const next = (auth.user.balance ?? 0) + (b.winAmount ?? 0);
        auth.setBalance(next);
        auth.bumpStats({ totalWin: b.winAmount ?? 0 });
        useBetStore.setState({ lastWin: b.winAmount ?? 0 });
      }
      wallet.pushTransaction({
        userId: b.userId,
        type: "BET_WIN",
        amount: b.winAmount ?? 0,
        balanceBefore: 0,
        balanceAfter: 0,
        status: "COMPLETED",
        description: `Win: ${b.betType} ${b.betNumber}`,
      });
      notif.push({
        userId: b.userId,
        type: "bet_won",
        title: "🎉 You won!",
        body: `Your ${b.betType} bet of ₹${b.amount} won ₹${(b.winAmount ?? 0).toLocaleString("en-IN")}.`,
      });
    } else {
      notif.push({
        userId: b.userId,
        type: "bet_lost",
        title: "Result declared",
        body: `Your bet on ${b.betNumber} did not win this session.`,
      });
    }
  }
  realtime.emit(
    "bet:settlement:batch",
    `📊 ${settled.settled.length} bets evaluated · ${winners} winners · ₹${settled.totalPayout.toLocaleString("en-IN")} paid out`,
  );
  return { bets: settled.settled.length, payout: settled.totalPayout, winners };
}

// ─────────────────────────────────────────────────────────────────────────────
// Corrections
// ─────────────────────────────────────────────────────────────────────────────

export interface CorrectionInput {
  marketId: string;
  sessionDate: string;
  session: SessionType;
  newPana: string;
  reason: string;
}

export async function correctResult(input: CorrectionInput): Promise<
  | { ok: true; oldPana: string; newPana: string; settledBets: number }
  | { ok: false; error: string }
> {
  await delay(150);

  if (!isValidPana(input.newPana)) return { ok: false, error: "Invalid pana" };
  if (input.reason.trim().length < 10)
    return { ok: false, error: "Reason must be at least 10 characters" };

  const existing = useMarketStore.getState().results.find(
    (r) => r.marketId === input.marketId && r.sessionDate === input.sessionDate,
  );
  if (!existing) return { ok: false, error: "No declared result to correct" };
  const oldPana = input.session === "OPEN" ? existing.openPana : existing.closePana;
  if (!oldPana) return { ok: false, error: "Session not declared" };

  const declaredAt = existing.declaredAt ? new Date(existing.declaredAt).getTime() : 0;
  if (Date.now() - declaredAt > CORRECTION_WINDOW_MS) {
    return { ok: false, error: "Correction window expired (10 minutes)" };
  }

  // Reverse prior settlement: refund bet wins for affected session
  const bets = useBetStore.getState().bets;
  const auth = useAuthStore.getState();
  const wallet = useWalletStore.getState();

  const affected = bets.filter(
    (b) =>
      b.marketId === input.marketId &&
      b.sessionDate === input.sessionDate &&
      b.session === input.session,
  );
  for (const b of affected) {
    if (b.status === "WON" && auth.user?.id === b.userId) {
      const next = (auth.user.balance ?? 0) - (b.winAmount ?? 0);
      auth.setBalance(Math.max(0, next));
      auth.bumpStats({ totalWin: -(b.winAmount ?? 0) });
    }
    if (b.status === "WON") {
      wallet.pushTransaction({
        userId: b.userId,
        type: "ADMIN_DEBIT",
        amount: b.winAmount ?? 0,
        balanceBefore: 0, balanceAfter: 0,
        status: "COMPLETED",
        description: "Reversal: result correction",
      });
    }
  }
  // reset to PENDING then re-settle
  useBetStore.setState({
    bets: bets.map((b) =>
      affected.find((a) => a.id === b.id)
        ? { ...b, status: "PENDING", winAmount: undefined, settledAt: undefined }
        : b,
    ),
  });

  // upsert with new pana
  const digit = digitFromPana(input.newPana);
  const merged: MarketResult = {
    ...existing,
    openPana: input.session === "OPEN" ? input.newPana : existing.openPana,
    openDigit: input.session === "OPEN" ? digit : existing.openDigit,
    closePana: input.session === "CLOSE" ? input.newPana : existing.closePana,
    closeDigit: input.session === "CLOSE" ? digit : existing.closeDigit,
    declaredAt: new Date().toISOString(), // restart correction window
  };
  if (merged.openDigit !== undefined && merged.closeDigit !== undefined) {
    merged.jodi = `${merged.openDigit}${merged.closeDigit}`;
  }
  useMarketStore.getState().upsertResult(merged);

  const settledRes = settleSessionBets(input.marketId, input.sessionDate, merged);

  const market = useMarketStore.getState().markets.find((m) => m.id === input.marketId)!;
  useAuditStore.getState().push({
    adminId: auth.user?.id ?? "system",
    adminEmail: auth.user?.email ?? "admin@sattaking.local",
    action: "CORRECTED",
    marketId: input.marketId, marketName: market.displayName,
    session: input.session, sessionDate: input.sessionDate,
    oldPana, newPana: input.newPana,
    reason: input.reason,
    betsAffected: settledRes.bets,
    payout: settledRes.payout,
  });
  useRealtimeStore.getState().emit(
    "result:corrected",
    `🔄 Result corrected for ${market.displayName} ${input.session} — ${oldPana} → ${input.newPana}`,
  );

  // Notify affected users
  const notif = useNotificationStore.getState();
  const userIds = new Set(affected.map((b) => b.userId));
  for (const uid of userIds) {
    notif.push({
      userId: uid,
      type: "result_declared",
      title: "⚠️ Result corrected",
      body: `${market.displayName} ${input.session} result corrected. Your bet has been re-evaluated.`,
    });
  }

  return { ok: true, oldPana, newPana: input.newPana, settledBets: settledRes.bets };
}

// Handy export for forms that compute payout multipliers locally
export { payoutFor };
