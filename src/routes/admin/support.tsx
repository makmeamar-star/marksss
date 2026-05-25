import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MessageCircle, Send, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Customer Support — Admin" }] }),
  component: AdminSupportPage,
});

type SupportContacts = {
  enabled: boolean;
  whatsapp_number: string;
  whatsapp_message: string;
  telegram_username: string;
};

const DEFAULTS: SupportContacts = {
  enabled: true,
  whatsapp_number: "",
  whatsapp_message: "Hi, I need help with my SattaKing Pro account.",
  telegram_username: "",
};

function AdminSupportPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<SupportContacts>(DEFAULTS);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["support-contacts-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "support_contacts")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as SupportContacts | null) ?? DEFAULTS;
    },
  });

  useEffect(() => {
    if (data) setForm({ ...DEFAULTS, ...data });
  }, [data]);

  const update = (p: Partial<SupportContacts>) => setForm((s) => ({ ...s, ...p }));

  const save = async () => {
    const wa = form.whatsapp_number.trim();
    if (wa && !/^\+?\d{8,15}$/.test(wa)) {
      return toast.error("WhatsApp number must be digits only (8–15 digits), optional leading +");
    }
    const tg = form.telegram_username.trim().replace(/^@/, "");
    if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) {
      return toast.error("Telegram username must be 5–32 letters/digits/underscores");
    }
    if (form.whatsapp_message.length > 500) {
      return toast.error("Pre-filled message must be 500 characters or fewer");
    }
    setBusy(true);
    try {
      const payload: SupportContacts = {
        enabled: form.enabled,
        whatsapp_number: wa,
        whatsapp_message: form.whatsapp_message.trim(),
        telegram_username: tg,
      };
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "support_contacts", value: payload, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success("Support contacts saved");
      qc.invalidateQueries({ queryKey: ["support-contacts-admin"] });
      qc.invalidateQueries({ queryKey: ["support-contacts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-5">
      <header>
        <h1 className="font-display text-3xl font-bold">Customer Support</h1>
        <p className="text-sm text-muted-foreground">
          Configure the WhatsApp and Telegram contact links shown to players via the floating help button.
        </p>
      </header>

      <div className="glass rounded-xl p-5 space-y-5">
        {isLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-5 w-5 inline animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div>
                <div className="font-semibold text-sm">Show support button</div>
                <div className="text-xs text-muted-foreground">Display the floating help button to players.</div>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(v) => update({ enabled: v })} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-success" /> WhatsApp number</Label>
              <Input
                value={form.whatsapp_number}
                onChange={(e) => update({ whatsapp_number: e.target.value })}
                placeholder="+919876543210"
                inputMode="tel"
              />
              <p className="text-[11px] text-muted-foreground">Include country code. Digits only, optional leading +.</p>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp pre-filled message</Label>
              <Textarea
                rows={2}
                value={form.whatsapp_message}
                onChange={(e) => update({ whatsapp_message: e.target.value })}
                placeholder="Hi, I need help with my account."
                maxLength={500}
              />
              <p className="text-[11px] text-muted-foreground">{form.whatsapp_message.length}/500</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Telegram username</Label>
              <Input
                value={form.telegram_username}
                onChange={(e) => update({ telegram_username: e.target.value })}
                placeholder="sattakingsupport"
              />
              <p className="text-[11px] text-muted-foreground">Without @. Opens t.me/&lt;username&gt;.</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={busy} className="bg-gradient-gold text-background font-bold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
