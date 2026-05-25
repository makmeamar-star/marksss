import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send, Copy, Check, HelpCircle, QrCode, Landmark, Smartphone, ArrowRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — SattaKing Pro" },
      { name: "description", content: "Get help via WhatsApp, Telegram, or find answers about payments and gameplay." },
    ],
  }),
  component: SupportPage,
});

type SupportContacts = {
  enabled?: boolean;
  whatsapp_number?: string;
  whatsapp_message?: string;
  telegram_username?: string;
};

function SupportPage() {
  const { data: contacts, isLoading } = useQuery({
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <header className="text-center space-y-2">
        <h1 className="font-display text-3xl font-bold">Customer Support</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Need help? Reach out via WhatsApp or Telegram. You can also browse payment guides below.
        </p>
      </header>

      {/* Contact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <WhatsAppCard contacts={contacts} loading={isLoading} />
        <TelegramCard contacts={contacts} loading={isLoading} />
      </div>

      {/* Payment Help */}
      <PaymentHelp />

      {/* Quick FAQ */}
      <QuickFaq />
    </div>
  );
}

function WhatsAppCard({ contacts, loading }: { contacts: SupportContacts | null | undefined; loading: boolean }) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <Card className="p-6 animate-pulse bg-card/60 border-success/20">
        <div className="h-24 bg-muted rounded-md" />
      </Card>
    );
  }

  const wa = (contacts?.whatsapp_number ?? "").replace(/[^\d+]/g, "");
  const enabled = contacts?.enabled !== false;
  const waHref = wa
    ? `https://wa.me/${wa.replace(/^\+/, "")}?text=${encodeURIComponent(contacts?.whatsapp_message ?? "Hi")}`
    : null;

  return (
    <Card className="p-6 border-success/30 bg-gradient-to-br from-card to-card/80 hover:border-success/60 transition-colors">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg">WhatsApp Support</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {enabled && wa ? "Fastest response. Chat directly with our support team." : "WhatsApp support is currently unavailable."}
          </p>
          {enabled && wa && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CopyButton text={wa} copied={copied} onChange={setCopied} />
              <a href={waHref ?? undefined} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-success hover:bg-success/90 text-background font-semibold gap-1.5">
                  Chat Now <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function TelegramCard({ contacts, loading }: { contacts: SupportContacts | null | undefined; loading: boolean }) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <Card className="p-6 animate-pulse bg-card/60 border-primary/20">
        <div className="h-24 bg-muted rounded-md" />
      </Card>
    );
  }

  const tg = (contacts?.telegram_username ?? "").replace(/^@/, "").trim();
  const enabled = contacts?.enabled !== false;
  const tgHref = tg ? `https://t.me/${tg}` : null;

  return (
    <Card className="p-6 border-primary/30 bg-gradient-to-br from-card to-card/80 hover:border-primary/60 transition-colors">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Send className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg">Telegram Support</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {enabled && tg ? "Get updates and support via Telegram messenger." : "Telegram support is currently unavailable."}
          </p>
          {enabled && tg && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CopyButton text={tg} copied={copied} onChange={setCopied} />
              <a href={tgHref ?? undefined} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="font-semibold gap-1.5">
                  Open Telegram <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CopyButton({ text, copied, onChange }: { text: string; copied: boolean; onChange: (v: boolean) => void }) {
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onChange(true);
      toast.success("Copied to clipboard");
      setTimeout(() => onChange(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <Button size="sm" variant="secondary" onClick={handle} className="gap-1.5 font-mono text-xs">
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function PaymentHelp() {
  const steps = [
    {
      icon: Wallet,
      title: "Go to Wallet",
      body: "Tap Wallet in the sidebar or bottom nav, then choose Add Funds.",
    },
    {
      icon: QrCode,
      title: "Scan QR or Copy UPI ID",
      body: "Select a payment channel. Tap the copy icon next to the UPI ID, or scan the QR code with any UPI app.",
    },
    {
      icon: Landmark,
      title: "Use Bank Transfer",
      body: "If you prefer net banking, copy the Account Number and IFSC. Use the ‘Copy All Bank Details’ button to copy everything at once.",
    },
    {
      icon: Smartphone,
      title: "Enter Amount & Pay",
      body: "Send the exact amount shown. Come back and enter the UTR / transaction ID to confirm.",
    },
  ];

  return (
    <Card className="p-6 border-border/60">
      <div className="flex items-center gap-3 mb-5">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-warning/15 text-warning">
          <HelpCircle className="h-5 w-5" />
        </div>
        <h2 className="font-display text-xl font-bold">How to Add Money</h2>
      </div>

      <div className="space-y-5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-4">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary/40 text-secondary font-bold text-sm">
              {i + 1}
            </div>
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg bg-muted/50 border border-border/40 p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-warning" /> Payment not reflecting?
        </p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>Double-check that you entered the correct UTR / transaction reference.</li>
          <li>It can take 5–15 minutes for the admin to verify and approve.</li>
          <li>If it’s been longer, contact support via WhatsApp with a screenshot.</li>
          <li>Do not send money to any account not listed in your Wallet page.</li>
        </ul>
      </div>
    </Card>
  );
}

function QuickFaq() {
  const faqs = [
    { q: "Is my money safe?", a: "Yes. Deposits are held securely and only released after admin verification." },
    { q: "What is a UTR?", a: "UTR (Unique Transaction Reference) is a 12-digit number generated after a successful UPI or bank transfer. You must enter it to confirm your deposit." },
    { q: "Can I cancel a bet?", a: "Bets cannot be cancelled once the market is locked or the result timer starts." },
    { q: "How do I withdraw winnings?", a: "Go to Wallet → Withdraw. Enter your bank or UPI details and submit a request. Withdrawals are processed after admin review." },
  ];

  return (
    <Card className="p-6 border-border/60">
      <h2 className="font-display text-xl font-bold mb-4">Quick FAQ</h2>
      <div className="space-y-4">
        {faqs.map((f, i) => (
          <div key={i} className="border-b border-border/40 last:border-0 pb-4 last:pb-0">
            <h3 className="font-semibold text-sm">{f.q}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
