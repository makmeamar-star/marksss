/**
 * fixresult.in scraper using their public JSON API
 * (the same API their own homepage frontend calls).
 */

import { createHash } from "crypto";
import type { DpbossDayResult } from "./dpboss.server";

const API_URL = "https://api.fixresult.in/api/v1/markets";
const API_KEY = "my-secret-api-key-123";
const SIGN_SALT = "FIXRESULT_PUBLIC_SALT";
const TIMEOUT_MS = 8000;

interface FixMarket {
  name: string;
  slug: string;
  jodi?: string;
  openPanel?: string;
  closePanel?: string;
}

const cache = new Map<string, { at: number; data: FixMarket[] }>();
const CACHE_TTL_MS = 60_000;

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchFixresultPanel(slug: string): Promise<DpbossDayResult[]> {
  const all = await fetchAll();
  const wanted = normaliseName(slug);
  const hit = all.find((m) => normaliseName(m.slug || m.name) === wanted);
  if (!hit) return [];
  return [
    {
      date: istToday(),
      openPana: validPana(hit.openPanel),
      jodi: validJodi(hit.jodi),
      closePana: validPana(hit.closePanel),
    },
  ];
}

async function fetchAll(): Promise<FixMarket[]> {
  const cached = cache.get(API_URL);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const ts = Math.floor(Date.now() / 1000).toString();
  const sign = createHash("sha256").update(API_KEY + ts + SIGN_SALT).digest("hex");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-ts": ts,
        "x-sign": sign,
        "user-agent":
          "Mozilla/5.0 (compatible; SattaResultsBot/1.0; +https://matka.bharatkaal.online)",
      },
    });
    if (!res.ok) throw new Error(`fixresult.in api ${res.status}`);
    const json = (await res.json()) as { data?: FixMarket[] };
    const data = json.data ?? [];
    cache.set(API_URL, { at: Date.now(), data });
    return data;
  } finally {
    clearTimeout(t);
  }
}

function validPana(s: string | undefined | null): string | null {
  if (!s) return null;
  const d = s.replace(/[^0-9]/g, "");
  return d.length === 3 ? d : null;
}

function validJodi(s: string | undefined | null): string | null {
  if (!s) return null;
  const d = s.replace(/[^0-9]/g, "");
  return d.length === 2 ? d : null;
}

function istToday(): string {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}
