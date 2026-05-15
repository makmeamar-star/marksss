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
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;

export interface DpbossDayResult {
  date: string;          // YYYY-MM-DD
  openPana: string | null;
  closePana: string | null;
  jodi: string | null;
}

/** Error thrown after all retries are exhausted. Carries structured context. */
export class DpbossFetchError extends Error {
  readonly url: string;
  readonly attempts: number;
  readonly lastStatus?: number;
  readonly cause?: unknown;
  constructor(message: string, info: { url: string; attempts: number; lastStatus?: number; cause?: unknown }) {
    super(message);
    this.name = "DpbossFetchError";
    this.url = info.url;
    this.attempts = info.attempts;
    this.lastStatus = info.lastStatus;
    this.cause = info.cause;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Whether to retry a given HTTP status (transient server / rate-limit). */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

/** Fetch and parse the entire panel chart for a market slug, with retries. */
export async function fetchDpbossPanel(slug: string): Promise<DpbossDayResult[]> {
  const url = `${BASE}/${encodeURIComponent(slug)}.php?full_chart`;
  let lastStatus: number | undefined;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; SattaResultsBot/1.0; +https://matka.bharatkaal.online)",
          accept: "text/html",
          "cache-control": "no-cache",
        },
      });
      lastStatus = res.status;

      if (!res.ok) {
        const bodySnippet = await safeReadSnippet(res);
        const err = new Error(
          `dpboss.boston ${res.status} ${res.statusText} for ${slug} (attempt ${attempt}/${MAX_ATTEMPTS}, ${Date.now() - startedAt}ms): ${bodySnippet}`,
        );
        if (attempt < MAX_ATTEMPTS && isRetryableStatus(res.status)) {
          console.warn(`[dpboss] retryable ${res.status} for ${slug}, attempt ${attempt}`);
          lastErr = err;
          await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
          continue;
        }
        throw new DpbossFetchError(err.message, { url, attempts: attempt, lastStatus, cause: err });
      }

      const html = await res.text();
      if (!html || html.length < 200) {
        const err = new Error(
          `dpboss.boston returned empty/short body (${html?.length ?? 0} bytes) for ${slug} on attempt ${attempt}`,
        );
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`[dpboss] empty body for ${slug}, attempt ${attempt}`);
          lastErr = err;
          await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
          continue;
        }
        throw new DpbossFetchError(err.message, { url, attempts: attempt, lastStatus, cause: err });
      }
      return parseDpbossPanel(html);
    } catch (e: any) {
      lastErr = e;
      // Already a structured error → bubble.
      if (e instanceof DpbossFetchError) throw e;

      const aborted = e?.name === "AbortError";
      const elapsed = Date.now() - startedAt;
      const detail = aborted
        ? `timeout after ${TIMEOUT_MS}ms`
        : `${e?.name ?? "Error"}: ${e?.message ?? String(e)}`;
      const msg = `dpboss.boston fetch failed for ${slug} (attempt ${attempt}/${MAX_ATTEMPTS}, ${elapsed}ms): ${detail}`;

      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[dpboss] ${msg} — retrying`);
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
        continue;
      }
      console.error(`[dpboss] ${msg} — giving up`);
      throw new DpbossFetchError(msg, { url, attempts: attempt, lastStatus, cause: e });
    } finally {
      clearTimeout(t);
    }
  }

  // Should be unreachable; satisfy TS.
  throw new DpbossFetchError("dpboss.boston fetch exhausted retries", {
    url,
    attempts: MAX_ATTEMPTS,
    lastStatus,
    cause: lastErr,
  });
}

async function safeReadSnippet(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 200).replace(/\s+/g, " ").trim();
  } catch {
    return "<no-body>";
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
