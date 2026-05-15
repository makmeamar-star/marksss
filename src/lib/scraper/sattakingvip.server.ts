/**
 * sattakingvip.co.in homepage scraper.
 *
 * Their homepage prints a single jodi-per-market block, e.g.:
 *
 *   <div class="satta_b">GALI</div>
 *   <div class="satta_a">42</div>
 *
 * We just pull every "MARKET / 2-digit" pair we can find and look up by
 * normalised slug. Returns a single "today" entry (IST date).
 */

import type { DpbossDayResult } from "./dpboss.server";

const BASE = "https://sattakingvip.co.in/";
const TIMEOUT_MS = 8000;

interface JodiRow {
  slug: string;
  jodi: string;
}

const cache = new Map<string, { at: number; data: JodiRow[] }>();
const CACHE_TTL_MS = 60_000;

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchSattakingvipPanel(slug: string): Promise<DpbossDayResult[]> {
  const all = await fetchAll();
  const wanted = normaliseName(slug);
  const hit = all.find((r) => r.slug === wanted);
  if (!hit) return [];
  return [
    {
      date: mapToRealDate(istToday()),
      openPana: null,
      closePana: null,
      jodi: hit.jodi,
    },
  ];
}

async function fetchAll(): Promise<JodiRow[]> {
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
          "Mozilla/5.0 (compatible; SattaResultsBot/1.0; +https://matka.bharatkaal.online)",
      },
    });
    if (!res.ok) throw new Error(`sattakingvip.co.in ${res.status}`);
    const html = await res.text();
    const rows = parse(html);
    cache.set(BASE, { at: Date.now(), data: rows });
    return rows;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Pull every "label then 2-digit number" pair out of the HTML, regardless of
 * the wrapping tags. Robust to minor markup changes since the site re-skins
 * itself often.
 */
function parse(html: string): JodiRow[] {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const tokens = stripped
    .replace(/<[^>]+>/g, "\n")
    .split(/\n+/)
    .map((s) => s.replace(/&nbsp;/g, " ").trim())
    .filter(Boolean);

  const out: JodiRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (!/^[A-Za-z][A-Za-z &.\-]{2,}$/.test(a)) continue;
    if (!/^[0-9]{2}$/.test(b)) continue;
    const slug = normaliseName(a);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, jodi: b });
  }
  return out;
}

function mapToRealDate(istDate: string): string {
  const target = new Date(istDate + "T00:00:00Z");
  const realToday = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  if (target.getTime() <= realToday.getTime()) return istDate;
  const targetDow = target.getUTCDay();
  const out = new Date(realToday);
  while (out.getUTCDay() !== targetDow) out.setUTCDate(out.getUTCDate() - 1);
  return out.toISOString().slice(0, 10);
}

function istToday(): string {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}
