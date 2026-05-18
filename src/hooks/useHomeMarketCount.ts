import { useEffect, useState } from "react";
import { TOP_MARKET_IDS } from "@/lib/topMarkets";

const STORAGE_KEY = "home_market_count";
export const DEFAULT_HOME_MARKET_COUNT = 15;
export const MAX_HOME_MARKET_COUNT = TOP_MARKET_IDS.length;
export const MIN_HOME_MARKET_COUNT = 1;

function clamp(n: number) {
  if (!Number.isFinite(n)) return DEFAULT_HOME_MARKET_COUNT;
  return Math.max(MIN_HOME_MARKET_COUNT, Math.min(MAX_HOME_MARKET_COUNT, Math.floor(n)));
}

function read(): number {
  if (typeof window === "undefined") return DEFAULT_HOME_MARKET_COUNT;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_HOME_MARKET_COUNT;
  const n = Number(raw);
  return clamp(n);
}

export function getHomeMarketCount(): number {
  return read();
}

export function setHomeMarketCount(n: number): number {
  const v = clamp(n);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, String(v));
    window.dispatchEvent(new CustomEvent("home-market-count-changed", { detail: v }));
  }
  return v;
}

export function useHomeMarketCount(): number {
  const [count, setCount] = useState<number>(DEFAULT_HOME_MARKET_COUNT);
  useEffect(() => {
    setCount(read());
    const onChange = () => setCount(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setCount(read());
    };
    window.addEventListener("home-market-count-changed", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("home-market-count-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return count;
}
