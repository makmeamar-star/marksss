import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send, HelpCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SupportContacts = {
  enabled?: boolean;
  whatsapp_number?: string;
  whatsapp_message?: string;
  telegram_username?: string;
};

export function SupportFab() {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["support-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "support_contacts")
        .maybeSingle();
      return (data?.value as SupportContacts | null) ?? null;
    },
    staleTime: 5 * 60_000,
  });

  if (!data || data.enabled === false) return null;
  const wa = (data.whatsapp_number ?? "").replace(/[^\d+]/g, "");
  const tg = (data.telegram_username ?? "").replace(/^@/, "").trim();
  if (!wa && !tg) return null;

  const waHref = wa
    ? `https://wa.me/${wa.replace(/^\+/, "")}?text=${encodeURIComponent(data.whatsapp_message ?? "Hi")}`
    : null;
  const tgHref = tg ? `https://t.me/${tg}` : null;

  return (
    <div className="fixed z-40 bottom-24 right-4 lg:bottom-6 lg:right-6 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-success text-background px-4 py-2.5 text-sm font-semibold shadow-lg hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Support
            </a>
          )}
          {tgHref && (
            <a
              href={tgHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-primary text-background px-4 py-2.5 text-sm font-semibold shadow-lg hover:opacity-90"
            >
              <Send className="h-4 w-4" /> Telegram Support
            </a>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close support menu" : "Open support menu"}
        className="grid h-12 w-12 place-items-center rounded-full bg-gradient-gold text-background shadow-xl hover:scale-105 transition-transform"
      >
        {open ? <X className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
