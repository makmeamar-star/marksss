/**
 * dpboss.services panel chart scraper.
 *
 * Parses the weekly panel chart at:
 *   https://dpboss.services/panel-chart-record/<slug>.php
 *
 * Each row is a Mon-Sat week with 18 cells per day-group:
 *   [open_pana_3digits] [jodi_2digits] [close_pana_3digits]
 *
 * Cells with `*` = not declared yet.
 *
 * Pure functions. Worker-safe (no DOM, no Node-only deps).
 */

const BASE = "https://dpboss.boston/panel-chart-record";
const TIMEOUT_MS = 8000;

export interface DpbossDayResult {
  date: string;          // YYYY-MM-DD
  openPana: string | null;
  closePana: string | null;
  jodi: string | null;
}

/** Fetch and parse the entire panel chart for a market slug. */
export async function fetchDpbossPanel(slug: string): Promise<DpbossDayResult[]> {
  const url = `${BASE}/${encodeURIComponent(slug)}.php?full_chart`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; SattaResultsBot/1.0; +https://matka.bharatkaal.online)",
        accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`dpboss ${res.status}`);
    const html = await res.text();
    return parseDpbossPanel(html);
  } finally {
    clearTimeout(t);
  }
}

/** Parse all days from the panel chart HTML. Exported for testing. */
export function parseDpbossPanel(html: string): DpbossDayResult[] {
  const out: DpbossDayResult[] = [];

  // dpboss does not always close <tbody>. Anchor on <tbody> start and end at
  // the next </table> instead.
  const tbodyStart = html.indexOf("<tbody>");
  if (tbodyStart < 0) return out;
  const tableEnd = html.indexOf("</table>", tbodyStart);
  const body = html.slice(tbodyStart, tableEnd > 0 ? tableEnd : html.length);

  // Split into rows
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(body)) !== null) {
    const row = rowMatch[1];
    const cells = extractCells(row);
    // Expect 1 date cell + 18 (6 days × 3) data cells = 19
    if (cells.length < 19) continue;

    const dateRange = cells[0];
    const startDate = parseStartDate(dateRange);
    if (!startDate) continue;

    // 6 days, Monday..Saturday (markets that don't run on a day will simply have *)
    for (let d = 0; d < 6; d++) {
      const openCell = cells[1 + d * 3];
      const jodiCell = cells[2 + d * 3];
      const closeCell = cells[3 + d * 3];

      const date = addDays(startDate, d);
      out.push({
        date,
        openPana: parsePana(openCell),
        jodi: parseJodi(jodiCell),
        closePana: parsePana(closeCell),
      });
    }
  }
  return out;
}

function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(rowHtml)) !== null) {
    cells.push(m[1]);
  }
  return cells;
}

/** Return YYYY-MM-DD of the start (Monday) of a "DD/MM/YYYY to DD/MM/YYYY" range. */
function parseStartDate(rangeHtml: string): string | null {
  const text = rangeHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parsePana(cellHtml: string): string | null {
  // Strip tags, collapse whitespace, then keep only digits
  const text = cellHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  if (!text || text.includes("*")) return null;
  const digits = text.replace(/[^0-9]/g, "");
  if (digits.length !== 3) return null;
  return digits;
}

function parseJodi(cellHtml: string): string | null {
  const text = cellHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  if (!text || text.includes("*")) return null;
  const digits = text.replace(/[^0-9]/g, "");
  if (digits.length !== 2) return null;
  return digits;
}
