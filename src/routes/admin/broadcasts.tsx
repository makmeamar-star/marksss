import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, Send, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { sendBroadcast, listRecentBroadcasts } from "@/lib/adminBroadcasts.functions";

export const Route = createFileRoute("/admin/broadcasts")({
  head: () => ({ meta: [{ title: "Broadcasts — Admin" }] }),
  component: BroadcastsPage,
});

function BroadcastsPage() {
  const qc = useQueryClient();
  const fetchHistory = useServerFn(listRecentBroadcasts);
  const send = useServerFn(sendBroadcast);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"ALL" | "ACTIVE" | "USER">("ACTIVE");
  const [userId, setUserId] = useState("");

  const { data: history = [] } = useQuery({
    queryKey: ["admin-broadcasts"],
    queryFn: () => fetchHistory(),
  });

  const mut = useMutation({
    mutationFn: () => send({
      data: {
        title, body,
        link: link || null,
        audience,
        userId: audience === "USER" ? userId : null,
      },
    }),
    onSuccess: (res) => {
      toast.success(`Sent to ${res.sent} user${res.sent === 1 ? "" : "s"}`);
      setTitle(""); setBody(""); setLink(""); setUserId("");
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSend = title.length >= 2 && body.length >= 2 &&
    (audience !== "USER" || /^[0-9a-f-]{36}$/i.test(userId));

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-primary" /> Broadcasts
          </h1>
          <p className="text-sm text-muted-foreground">Send in-app notifications to your users.</p>
        </div>
      </header>

      <section className="glass rounded-xl p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Maintenance window tonight" maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active users only</SelectItem>
                <SelectItem value="ALL">All users</SelectItem>
                <SelectItem value="USER">Single user (by ID)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {audience === "USER" && (
          <div className="space-y-2">
            <Label>User ID (UUID)</Label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
          </div>
        )}

        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What's happening?" rows={4} maxLength={500} />
          <div className="text-xs text-muted-foreground text-right">{body.length}/500</div>
        </div>

        <div className="space-y-2">
          <Label>Link (optional)</Label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/wallet" />
        </div>

        <Button disabled={!canSend || mut.isPending} onClick={() => mut.mutate()} className="bg-gradient-gold text-background font-bold">
          <Send className="h-4 w-4 mr-2" /> {mut.isPending ? "Sending…" : "Send broadcast"}
        </Button>
      </section>

      <section className="glass rounded-xl p-5">
        <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" /> Recent broadcasts
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {history.map((h: any) => (
              <li key={h.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{h.reason ?? "(untitled)"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {h.metadata?.audience} · sent to {h.metadata?.sent} user{h.metadata?.sent === 1 ? "" : "s"}
                </div>
                {h.metadata?.body && (
                  <p className="text-xs text-muted-foreground/90 mt-1">{h.metadata.body}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
