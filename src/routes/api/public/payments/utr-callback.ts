import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// External payment-aggregator webhook for UTR auto-verification.
// HMAC-SHA256 over raw body using shared secret UTR_WEBHOOK_SECRET.
// Header: x-utr-signature: <hex>
// Body: { utr: string, amount: number, payee?: string }

export const Route = createFileRoute("/api/public/payments/utr-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.UTR_WEBHOOK_SECRET;
        if (!secret) {
          return new Response(JSON.stringify({ ok: false, error: "webhook_not_configured" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        const sig = request.headers.get("x-utr-signature") ?? "";
        const raw = await request.text();
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const a = Buffer.from(sig, "hex");
        const b = Buffer.from(expected, "hex");
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("invalid signature", { status: 401 });
        }
        let payload: { utr?: string; amount?: number; payee?: string };
        try { payload = JSON.parse(raw); } catch {
          return new Response("invalid json", { status: 400 });
        }
        const utr = (payload.utr ?? "").trim();
        const amount = Number(payload.amount);
        if (!utr || !Number.isFinite(amount) || amount <= 0) {
          return new Response("bad payload", { status: 400 });
        }
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error } = await sb.rpc("auto_approve_deposit_by_utr", {
          _utr: utr, _amount: amount, _payee: payload.payee ?? null,
        });
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          status: 200, headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
