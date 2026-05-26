import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMarkets, useResultsForDate } from "./useGameData";
import { todayIST } from "@/lib/marketTime";
import { triggerFreshScrape } from "@/lib/scrapeTrigger.functions";
import { supabase } from "@/integrations/supabase/client";


const COOLDOWN_MS = 90_000; // don't ping more than once every 90s per device
const KEY = "scrape-ping-at";

/**
 * If any active market is past its open/close time today but the
 * corresponding pana is still missing in market_results, ping the
 * scraper hook once to pull fresh data from dpboss. Throttled.
 *
 * Realtime on market_results will refresh the UI automatically when
 * the scraper writes the result.
 */
export function useEnsureFreshResults() {
  const today = todayIST();
  const { data: markets = [] } = useMarkets();
  const { data: results = [] } = useResultsForDate(today);
  const qc = useQueryClient();

  useEffect(() => {
    if (!markets.length) return;

    const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
    const hhmm = nowIst.toISOString().slice(11, 16);

    const byId = new Map(results.map((r) => [r.marketId, r]));
    const needsScrape = markets.some((m) => {
      if (m.status !== "ACTIVE") return false;
      const r = byId.get(m.id);
      const openMissing = !r?.openPana && hhmm >= m.openTime;
      const closeMissing = !r?.closePana && hhmm >= m.closeTime;
      return openMissing || closeMissing;
    });
    if (!needsScrape) return;

    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return;
    sessionStorage.setItem(KEY, String(Date.now()));

    // Trigger a server-side scrape via the authenticated wrapper. Unauthenticated
    // users no-op (cron picks up new results every 15 minutes regardless).
    triggerFreshScrape()
      .then(() => {
        setTimeout(() => qc.invalidateQueries({ queryKey: ["results", today] }), 1500);
      })
      .catch(() => {});
  }, [markets, results, today, qc]);
}
