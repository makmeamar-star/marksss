import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PwaPlatform = "android" | "ios" | "other";

export interface PwaFunnelRow {
  platform: PwaPlatform;
  shown: number;
  clicked: number;
  accepted: number;
  dismissed: number;
  installed: number;
  // Conversion rates as ratios (0-1).
  clickRate: number;
  acceptRate: number;
  installRate: number;
}

export interface PwaDailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  shown: number;
  installed: number;
}

export interface PwaFunnelResponse {
  rangeDays: number;
  totals: PwaFunnelRow;
  byPlatform: PwaFunnelRow[];
  daily: PwaDailyPoint[];
  totalEvents: number;
}

const InputSchema = z.object({
  rangeDays: z.number().int().min(1).max(180).default(30),
});

function emptyRow(platform: PwaPlatform): PwaFunnelRow {
  return {
    platform,
    shown: 0,
    clicked: 0,
    accepted: 0,
    dismissed: 0,
    installed: 0,
    clickRate: 0,
    acceptRate: 0,
    installRate: 0,
  };
}

function finalize(row: PwaFunnelRow): PwaFunnelRow {
  const r = { ...row };
  r.clickRate = r.shown > 0 ? r.clicked / r.shown : 0;
  r.acceptRate = r.clicked > 0 ? r.accepted / r.clicked : 0;
  r.installRate = r.shown > 0 ? r.installed / r.shown : 0;
  return r;
}

export const getPwaInstallFunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<PwaFunnelResponse> => {
    const { supabase, userId } = context;

    // Admin gate (RLS would block too, but explicit gate gives a clean 403).
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!(roles ?? []).some((r) => r.role === "admin")) {
      throw new Response("Forbidden", { status: 403 });
    }

    const since = new Date(Date.now() - data.rangeDays * 24 * 3600 * 1000).toISOString();

    const { data: events, error } = await supabase
      .from("pwa_install_events")
      .select("event, platform, outcome, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(50000);

    if (error) throw new Response(error.message, { status: 500 });

    const rows: Record<PwaPlatform, PwaFunnelRow> = {
      android: emptyRow("android"),
      ios: emptyRow("ios"),
      other: emptyRow("other"),
    };
    const totals = emptyRow("other");
    totals.platform = "other"; // placeholder; we'll treat as "all" client-side
    const dailyMap = new Map<string, PwaDailyPoint>();

    for (const row of events ?? []) {
      const platform = (row.platform === "android" || row.platform === "ios")
        ? (row.platform as PwaPlatform)
        : "other";
      const bucket = rows[platform];
      const date = String(row.created_at).slice(0, 10);
      const day = dailyMap.get(date) ?? { date, shown: 0, installed: 0 };

      switch (row.event) {
        case "pwa_install_prompt_shown":
          bucket.shown += 1;
          totals.shown += 1;
          day.shown += 1;
          break;
        case "pwa_install_prompt_clicked":
          bucket.clicked += 1;
          totals.clicked += 1;
          break;
        case "pwa_install_prompt_outcome":
          if (row.outcome === "accepted") {
            bucket.accepted += 1;
            totals.accepted += 1;
          } else if (row.outcome === "dismissed") {
            bucket.dismissed += 1;
            totals.dismissed += 1;
          }
          break;
        case "pwa_install_prompt_dismissed":
          bucket.dismissed += 1;
          totals.dismissed += 1;
          break;
        case "pwa_installed":
          bucket.installed += 1;
          totals.installed += 1;
          day.installed += 1;
          break;
      }
      dailyMap.set(date, day);
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      rangeDays: data.rangeDays,
      totals: finalize(totals),
      byPlatform: [finalize(rows.android), finalize(rows.ios), finalize(rows.other)],
      daily,
      totalEvents: events?.length ?? 0,
    };
  });
