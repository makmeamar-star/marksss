import type { Day, Market } from "./types";

const ALL_DAYS: Day[] = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const MON_SAT: Day[] = ["MON","TUE","WED","THU","FRI","SAT"];

const defaultPayouts = {
  single: 9,
  jodi: 90,
  singlePana: 150,
  doublePana: 300,
  triplePana: 600,
  halfSangam: 1000,
  fullSangam: 10000,
};

export const SEED_MARKETS: Market[] = [
  { id: "kalyan", name: "kalyan", displayName: "Kalyan",
    openTime: "15:45", closeTime: "17:45", resultTime: "18:00",
    days: MON_SAT, status: "ACTIVE", isOpen: false,
    minBet: 10, maxBet: 10000, payouts: defaultPayouts },
  { id: "main-mumbai", name: "main_mumbai", displayName: "Main Mumbai",
    openTime: "09:00", closeTime: "11:00", resultTime: "12:00",
    days: ALL_DAYS, status: "ACTIVE", isOpen: false,
    minBet: 10, maxBet: 10000, payouts: defaultPayouts },
  { id: "milan-day", name: "milan_day", displayName: "Milan Day",
    openTime: "12:00", closeTime: "14:00", resultTime: "14:30",
    days: MON_SAT, status: "ACTIVE", isOpen: false,
    minBet: 10, maxBet: 5000, payouts: defaultPayouts },
  { id: "milan-night", name: "milan_night", displayName: "Milan Night",
    openTime: "20:00", closeTime: "22:00", resultTime: "22:30",
    days: MON_SAT, status: "ACTIVE", isOpen: false,
    minBet: 10, maxBet: 5000, payouts: defaultPayouts },
  { id: "rajdhani-day", name: "rajdhani_day", displayName: "Rajdhani Day",
    openTime: "14:00", closeTime: "16:00", resultTime: "16:30",
    days: MON_SAT, status: "ACTIVE", isOpen: false,
    minBet: 10, maxBet: 10000, payouts: defaultPayouts },
  { id: "rajdhani-night", name: "rajdhani_night", displayName: "Rajdhani Night",
    openTime: "21:30", closeTime: "23:30", resultTime: "00:05",
    days: MON_SAT, status: "ACTIVE", isOpen: false,
    minBet: 10, maxBet: 10000, payouts: defaultPayouts },
  { id: "time-bazar", name: "time_bazar", displayName: "Time Bazar",
    openTime: "11:00", closeTime: "13:00", resultTime: "13:30",
    days: MON_SAT, status: "ACTIVE", isOpen: false,
    minBet: 10, maxBet: 10000, payouts: defaultPayouts },
  { id: "madhur-day", name: "madhur_day", displayName: "Madhur Day",
    openTime: "13:20", closeTime: "15:20", resultTime: "15:30",
    days: MON_SAT, status: "ACTIVE", isOpen: false,
    minBet: 10, maxBet: 10000, payouts: defaultPayouts },
];

/** Generate a few sample historical results for demo charts. */
export function seedSampleResults(marketIds: string[]) {
  const results: {
    marketId: string; sessionDate: string;
    openPana: string; openDigit: number;
    closePana: string; closeDigit: number;
    jodi: string; status: "DECLARED"; declaredAt: string;
  }[] = [];
  const samples = ["123","456","789","550","119","228","337","446","555","677"];
  const today = new Date();
  for (const id of marketIds) {
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const op = samples[Math.floor(Math.random() * samples.length)];
      const cp = samples[Math.floor(Math.random() * samples.length)];
      const od = op.split("").reduce((s, x) => s + Number(x), 0) % 10;
      const cd = cp.split("").reduce((s, x) => s + Number(x), 0) % 10;
      results.push({
        marketId: id, sessionDate: dateStr,
        openPana: op, openDigit: od,
        closePana: cp, closeDigit: cd,
        jodi: `${od}${cd}`, status: "DECLARED",
        declaredAt: d.toISOString(),
      });
    }
  }
  return results;
}
