// Compute IST-aware market open/closed state.
import type { Day, Market } from "./types";

const DAY_MAP: Day[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function nowIST(): { hhmm: string; day: Day; date: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hhmm = `${parts.hour}:${parts.minute}`;
  const wd = (parts.weekday || "Mon").slice(0, 3).toUpperCase();
  const day = (DAY_MAP.find((d) => d === wd) ?? "MON") as Day;
  return { hhmm, day, date };
}

export function todayIST(): string {
  return nowIST().date;
}

export function getNowHHMMIST(): string {
  return nowIST().hhmm;
}

type MarketWindow = Pick<Market, "openTime" | "closeTime" | "days" | "status">;

export function isOpenSessionOpen(m: MarketWindow): boolean {
  if (m.status !== "ACTIVE") return false;
  const { hhmm, day } = nowIST();
  if (!m.days.includes(day)) return false;
  return hhmm < m.openTime;
}

export function isCloseSessionOpen(m: MarketWindow): boolean {
  if (m.status !== "ACTIVE") return false;
  const { hhmm, day } = nowIST();
  if (!m.days.includes(day)) return false;
  return hhmm < m.closeTime;
}

// "Open" = bettable today (either OPEN or CLOSE session still accepting bets).
export function computeIsOpen(m: MarketWindow): boolean {
  return isCloseSessionOpen(m);
}
