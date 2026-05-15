/**
 * sattamatkadpboss.mobi homepage scraper.
 *
 * Their homepage lists every market in repeating blocks like:
 *   <span style="color:...">MARKET NAME</span><br>
 *   <span style="color:black;">OPEN-JODI-CLOSE</span>
 *
 * Returns a single "today" entry per market, IST date.
 */

import type { DpbossDayResult } from "./dpboss.server";

const BASE = "https://sattamatkadpboss.mobi/";
const TIMEOUT_MS = 8000;

export interface SmdResult {
  slug: string;       // normalised slug
  marketName: string; // raw name
  openPana: string | null;
  jodi: string | null;
  closePana: string | null;
}

const cache = new Map<string, { at: number; data: SmdResult[] }>();
const CACHE_TTL_MS = 60_000;

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[{}]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchSattamatkadpbossPanel(slug: string): Promise<DpbossDayResult[]> {
  const today = istToday();
  const all = await fetchAllSmd();
  const wanted = normaliseName(slug);
  const hit = all.find((r) => r.slug === wanted);
  if (!hit) return [];
  return [
    {
      date: today,
      openPana: hit.openPana,
      jodi: hit.jodi,
      closePana: hit.closePana,
    },
  ];
}

async function fetchAllSmd(): Promise<SmdResult[]> {
  const cached = cache.get(BASE);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE, {
      signal: ctrl.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; SattaResultsBot/1.0; +https://matka.bharatkaal.online)",
        accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`sattamatkadpboss.mobi ${res.status}`);
    const html = await res.text();
    const parsed = parseSmd(html);
    cache.set(BASE, { at: Date.now(), data: parsed });
    return parsed;
  } finally {
    clearTimeout(t);
  }
}

export function parseSmd(html: string): SmdResult[] {
  const out: SmdResult[] = [];
  // Match the two-span pattern: header span (uppercase name) followed by a
  // span containing the result. Both are inside a div, but we anchor on
  // <span color="..."> NAME </span><br><span color:black> RESULT </span>.
  const re =
    /<span[^>]*color\s*:\s*[^"']+["'][^>]*>\s*([A-Z][A-Z0-9 &{}\-\.]+?)\s*<\/span>\s*<br\s*\/?>\s*<span[^>]*color\s*:\s*black[^>]*>\s*([0-9\-\sX*]+?)\s*<\/span>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html)) !== null) {
    const rawName = m[1].trim();
    const result = m[2].trim();
    if (!rawName || rawName.length < 2) continue;
    const slug = normaliseName(rawName);
    if (!slug || seen.has(slug)) continue;
    const parsed = parseResult(result);
    seen.add(slug);
    out.push({ slug, marketName: rawName, ...parsed });
  }
  return out;
}

function parseResult(text: string): { openPana: string | null; jodi: string | null; closePana: string | null } {
  const parts = text.split("-").map((p) => p.trim());
  const openPana = digitOnly(parts[0], 3);
  const jodi = digitOnly(parts[1], 2);
  const closePana = digitOnly(parts[2], 3);
  return { openPana, jodi, closePana };
}

function digitOnly(s: string | undefined, len: number): string | null {
  if (!s || /[*xX]/.test(s)) return null;
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length !== len) return null;
  return digits;
}

function istToday(): string {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}
