/**
 * dpboss "gali / disawar" style monthly chart scraper.
 *
 *   https://dpboss.boston/chart/<slug>.php
 *
 * The chart is a Day x Month grid where each cell is a single 2-digit jodi
 * (or "**" if not declared). We only need today's cell, so we just collect
 * every (date -> jodi) pair we can detect and return them tagged.
 */

import type { DpbossDayResult } from "./dpboss.server";

const BASE = "https://dpboss.boston/chart";
const TIMEOUT_MS = 8000;

const cache = new Map<string, { at: number; data: DpbossDayResult[] }>();
const CACHE_TTL_MS = 60_000;

export async function fetchGaliDisawarChart(slug: string): Promise<DpbossDayResult[]> {
  const url = `${BASE}/${encodeURIComponent(slug)}.php`;
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        accept: "text/html",
        "user-agent":
          "Mozilla/5.0 (compatible; SattaResultsBot/1.0; +https://matka.bharatkaal.online)",
      },
    });
    if (!res.ok) throw new Error(`dpboss chart ${res.status} for ${slug}`);
    const html = await res.text();
    const rows = parse(html);
    cache.set(url, { at: Date.now(), data: rows });
    return rows;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Tolerant parser: walks the table body and pairs the day-of-month + month-year
 * column header with each cell's 2-digit jodi. We don't need the whole grid,
 * just (date -> jodi) pairs for the current/recent days.
 */
function parse(html: string): DpbossDayResult[] {
  // Pull all <tr>...</tr>
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const headerMonths: string[] = [];
  let firstRow = true;
  const out: DpbossDayResult[] = [];

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const cells = [...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      stripTags(c[1]).trim(),
    );
    if (cells.length === 0) continue;

    if (firstRow && cells.some((c) => /[A-Za-z]+\s*-?\s*\d{2,4}/.test(c))) {
      // Month header row, like "Jan-2025", "Feb-2025"...
      for (const c of cells.slice(1)) headerMonths.push(c);
      firstRow = false;
      continue;
    }
    firstRow = false;

    const day = cells[0]?.match(/^\d{1,2}$/)?.[0];
    if (!day) continue;
    const dayNum = parseInt(day, 10);
    if (dayNum < 1 || dayNum > 31) continue;

    for (let i = 1; i < cells.length; i++) {
      const jodi = cells[i].match(/^\d{2}$/)?.[0];
      if (!jodi) continue;
      const month = headerMonths[i - 1];
      const date = monthHeaderToDate(month, dayNum);
      if (!date) continue;
      out.push({ date, openPana: null, closePana: null, jodi });
    }
  }
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function monthHeaderToDate(header: string | undefined, day: number): string | null {
  if (!header) return null;
  const mm = header.match(/([A-Za-z]{3,9})\s*-?\s*(\d{2,4})/);
  if (!mm) return null;
  const monthIdx = MONTHS[mm[1].slice(0, 3).toLowerCase()];
  if (!monthIdx) return null;
  let year = parseInt(mm[2], 10);
  if (year < 100) year += 2000;
  const mm2 = String(monthIdx).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm2}-${dd}`;
}
