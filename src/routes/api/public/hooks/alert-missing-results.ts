import { createFileRoute } from "@tanstack/react-router";
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Periodically scans markets whose scheduled time for today has passed (plus
 * grace) but no result is declared yet, and notifies admins via web push +
 * in-app notifications row. Deduped per market+session+date via system_alerts.
 *
 * Schedule via pg_cron, every 5 minutes.
 */
export const Route = createFileRoute("/api/public/hooks/alert-missing-results")({
  server: {
    handlers: {
      POST: async () => {
        const { data: missing, error } = await supabaseAdmin.rpc("find_missing_results");
        if (error) {
          console.error("find_missing_results", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const rows = (missing ?? []) as Array<{
          market_id: string;
          display_name: string;
          session: "OPEN" | "CLOSE";
          scheduled_time: string;
          minutes_overdue: number;
        }>;

        if (rows.length === 0) {
          return Response.json({ ok: true, alerted: 0, missing: 0 });
        }

        const todayIst = new Date(Date.now() + 5.5 * 3600 * 1000)
          .toISOString()
          .slice(0, 10);

        // Find admin user ids
        const { data: admins } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        const adminIds = Array.from(new Set((admins ?? []).map((r) => r.user_id)));

        // VAPID setup (best-effort; if not configured, skip push but still record alerts/notifications)
        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
        const pushReady = Boolean(vapidPublic && vapidPrivate);
        if (pushReady) {
          webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);
        }

        const { data: subs } = pushReady && adminIds.length
          ? await supabaseAdmin
              .from("push_subscriptions")
              .select("id, endpoint, p256dh, auth")
              .in("user_id", adminIds)
          : { data: [] as Array<{ id: string; endpoint: string; p256dh: string; auth: string }> };

        let alerted = 0;
        let pushSent = 0;
        const goneIds: string[] = [];

        for (const r of rows) {
          const dedupeKey = `missing-result:${r.market_id}:${todayIst}:${r.session}`;

          // Dedupe via system_alerts (one per market+session+date)
          const { data: existing } = await supabaseAdmin
            .from("system_alerts")
            .select("id")
            .eq("source", "missing-result")
            .contains("context", { dedupe_key: dedupeKey })
            .is("resolved_at", null)
            .limit(1)
            .maybeSingle();
          if (existing) continue;

          await supabaseAdmin.from("system_alerts").insert({
            severity: "warning",
            source: "missing-result",
            title: `${r.display_name} — ${r.session.toLowerCase()} result missing`,
            message: `Scheduled at ${r.scheduled_time}, ${r.minutes_overdue} min overdue. Declare manually.`,
            context: {
              dedupe_key: dedupeKey,
              market_id: r.market_id,
              session: r.session,
              session_date: todayIst,
              minutes_overdue: r.minutes_overdue,
            },
          });
          alerted++;

          // In-app notification per admin
          if (adminIds.length) {
            const link = `/admin/results/declare?market=${encodeURIComponent(
              r.market_id,
            )}&session=${r.session}`;
            const notifRows = adminIds.map((uid) => ({
              user_id: uid,
              type: "admin_alert",
              title: `${r.display_name} — declare ${r.session.toLowerCase()}`,
              body: `Scheduled ${r.scheduled_time} · ${r.minutes_overdue} min overdue.`,
              link,
              metadata: {
                market_id: r.market_id,
                session: r.session,
                session_date: todayIst,
              },
            }));
            await supabaseAdmin.from("notifications").insert(notifRows);
          }

          // Web push to admin subscribers
          if (pushReady && subs && subs.length) {
            const payload = JSON.stringify({
              title: `${r.display_name} — declare ${r.session.toLowerCase()}`,
              body: `${r.minutes_overdue} min overdue. Tap to declare.`,
              url: `/admin/results/declare?market=${encodeURIComponent(
                r.market_id,
              )}&session=${r.session}`,
              tag: dedupeKey,
            });
            await Promise.all(
              subs.map(async (s) => {
                try {
                  await webpush.sendNotification(
                    { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                    payload,
                  );
                  pushSent++;
                } catch (err: unknown) {
                  const status = (err as { statusCode?: number })?.statusCode;
                  if (status === 404 || status === 410) goneIds.push(s.id);
                }
              }),
            );
          }
        }

        if (goneIds.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", goneIds);
        }

        return Response.json({ ok: true, missing: rows.length, alerted, pushSent });
      },
      GET: async () =>
        Response.json({ ok: true, hint: "POST to scan and alert" }),
    },
  },
});
