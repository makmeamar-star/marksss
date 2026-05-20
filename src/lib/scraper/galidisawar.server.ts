/**
 * sattaking.in homepage scraper for the four Delhi (jodi-only) markets:
 * Gali, Disawar, Faridabad, Ghaziabad.
 *
 * The homepage prints a list of rows like:
 *   "GALI 11:50 PM CHART 86 Yesterday __ Today"
 *   "FARIDABAD 06:00 PM CHART 49 Yesterday __ Today"
 *
 * We pull every (NAME, YESTERDAY, TODAY) triple, then resolve the slug
 * to one of those rows. "__" means the result hasn't been declared yet.
 *
 * The function name + return shape are preserved so the existing
 * scraper coordinator (index.server.ts) keeps working unchanged.
 */

import type { DpbossDayResult } from "./dpboss.server";

const BASE = "https://sattaking.in/";
const TIMEOUT_MS = 10_000;

const cache = new Map<string, { at: number; data: Row[] }>();
const CACHE_TTL_MS = 60_000;

interface Row {
  name: string; // upper-case canonical row name from sattaking.in
  yesterday: string | null;
  today: string | null;
}

// slug (from market_source_map) → list of acceptable row names on sattaking.in
// (case-insensitive, matched after collapsing whitespace).
const SLUG_TO_NAMES: Record<string, string[]> = {
  gali: ["GALI"],
  disawar: ["DESAWAR", "SUPER FAST RESULTS DESAWAR"],
  faridabad: ["FARIDABAD"],
  ghaziabad: ["GHAZIABAD"],
};

export async function fetchGaliDisawarChart(slug: string): Promise<DpbossDayResult[]> {
  const rows = await fetchRows();
  const accepted = SLUG_TO_NAMES[slug.toLowerCase()] ?? [slug.toUpperCase()];
  const hit = rows.find((r) => accepted.includes(r.name));
  if (!hit || !hit.today) return [];

  // Tag with every plausible "today" date the coordinator might look up,
  // so we work whether the app is on real-time or a future-shifted clock.
  const dates = candidateTodayDates();
  return dates.map((date) => ({
    date,
    openPana: null,
    closePana: null,
    jodi: hit.today!,
  }));
}

async function fetchRows(): Promise<Row[]> {
  const cached = cache.get(BASE);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE, {
      signal: ctrl.signal,
      headers: {
        accept: "text/html",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`sattaking.in ${res.status} for ${BASE}`);
    const html = await res.text();
    const rows = parse(html);
    cache.set(BASE, { at: Date.now(), data: rows });
    return rows;
  } finally {
    clearTimeout(t);
  }
}

function parse(html: string): Row[] {
  // Strip tags → single-line whitespace-normalised text.
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

  // Match "<NAME> <HH:MM AM/PM> CHART <Y> Yesterday <T> Today" rows.
  // Name allows letters, spaces and "&" (NAME group is non-greedy so we stop
  // at the first time literal).
  const re =
    /([A-Z][A-Z &]+?)\s+\d{1,2}:\d{2}\s*[AP]M\s+CHART\s+(\S+)\s+Yesterday\s+(\S+)\s+Today/g;

  const out: Row[] = [];
  for (const m of text.matchAll(re)) {
    const name = m[1].trim().replace(/\s+/g, " ");
    const y = m[2] === "__" ? null : /^\d{1,3}$/.test(m[2]) ? m[2].padStart(2, "0").slice(-2) : null;
    const tRaw = m[3];
    const t = tRaw === "__" ? null : /^\d{1,3}$/.test(tRaw) ? tRaw.padStart(2, "0").slice(-2) : null;
    out.push({ name, yesterday: y, today: t });
  }
  return out;
}

/**
 * The coordinator computes `lookupDate = mapToRealDpbossDate(istToday)`
 * and then does `days.find(d => d.date === lookupDate)`. Since sattaking.in's
 * "Today" is always the wall-clock real today, we tag the entry with every
 * date that lookupDate could equal:
 *   - IST today (when real time ≥ IST clock)
 *   - real UTC today
 *   - real UTC today walked back to IST today's weekday
 */
function candidateTodayDates(): string[] {
  const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
  const istToday = nowIst.toISOString().slice(0, 10);
  const realToday = new Date().toISOString().slice(0, 10);

  const target = new Date(istToday + "T00:00:00Z");
  const real = new Date(realToday + "T00:00:00Z");
  let walked = realToday;
  if (target.getTime() > real.getTime()) {
    const out = new Date(real);
    const dow = target.getUTCDay();
    while (out.getUTCDay() !== dow) out.setUTCDate(out.getUTCDate() - 1);
    walked = out.toISOString().slice(0, 10);
  }

  return Array.from(new Set([istToday, realToday, walked]));
}
