import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const bodySchema = z.object({
  market_id: z.string().min(1).max(100),
  session_date: z.string().min(1).max(40),
  jodi: z.string().max(10).nullable().optional(),
  open_pana: z.string().max(10).nullable().optional(),
  close_pana: z.string().max(10).nullable().optional(),
});

export const Route = createFileRoute("/api/public/hooks/dispatch-result-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-internal-secret");
        const expected = process.env.PUSH_DISPATCH_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
        if (!vapidPublic || !vapidPrivate) {
          return new Response("VAPID not configured", { status: 500 });
        }
        webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

        // Look up subscribers who opted in for this market
        const { data: prefs, error: prefsErr } = await supabaseAdmin
          .from("market_alert_preferences")
          .select("user_id")
          .eq("market_id", body.market_id)
          .eq("enabled", true);
        if (prefsErr) return new Response(prefsErr.message, { status: 500 });

        const userIds = Array.from(new Set((prefs ?? []).map((r) => r.user_id)));
        if (userIds.length === 0) return Response.json({ sent: 0 });

        const { data: subs, error: subsErr } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .in("user_id", userIds);
        if (subsErr) return new Response(subsErr.message, { status: 500 });

        const { data: market } = await supabaseAdmin
          .from("markets")
          .select("display_name")
          .eq("id", body.market_id)
          .maybeSingle();

        const marketName = market?.display_name ?? body.market_id;
        const resultLine = [body.open_pana, body.jodi, body.close_pana]
          .filter(Boolean)
          .join(" · ");

        const payload = JSON.stringify({
          title: `${marketName} — Result Declared`,
          body: resultLine || "Tap to see the result.",
          url: `/charts/${encodeURIComponent(body.market_id)}`,
          tag: `result-${body.market_id}-${body.session_date}`,
        });

        let sent = 0;
        const goneIds: string[] = [];
        await Promise.all(
          (subs ?? []).map(async (s) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
              );
              sent++;
            } catch (err: unknown) {
              const status = (err as { statusCode?: number })?.statusCode;
              if (status === 404 || status === 410) goneIds.push(s.id);
            }
          }),
        );

        if (goneIds.length > 0) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", goneIds);
        }

        return Response.json({ sent, pruned: goneIds.length });
      },
    },
  },
});
