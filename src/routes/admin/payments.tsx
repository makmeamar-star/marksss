import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Copy, Check, QrCode, Banknote, Smartphone, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Admin" }] }),
  component: AdminPaymentsPage,
});

type Channel = {
  id: string; type: "UPI" | "BANK" | "QR"; label: string;
  details: Record<string, string>; qr_image_url: string | null;
  instructions: string | null; active: boolean; priority: number;
  min_amount: number; max_amount: number; daily_cap: number | null;
};
type Method = {
  id: string; type: "UPI" | "BANK"; label: string; active: boolean;
  min_amount: number; max_amount: number; fee_pct: number;
  instructions: string | null; priority: number;
};

function AdminPaymentsPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-5">
      <header>
        <h1 className="font-display text-3xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Manage deposit channels (UPI / Bank / QR) and withdrawal methods shown to users.
        </p>
      </header>

      <Tabs defaultValue="channels">
        <TabsList className="bg-surface border border-border/60">
          <TabsTrigger value="channels">Deposit Channels</TabsTrigger>
          <TabsTrigger value="methods">Withdrawal Methods</TabsTrigger>
        </TabsList>
        <TabsContent value="channels"><ChannelsTab /></TabsContent>
        <TabsContent value="methods"><MethodsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- Deposit channels -------------------- */

function ChannelsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Channel> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_channels").select("*")
        .order("priority").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Channel[];
    },
  });

  const toggleActive = async (c: Channel) => {
    const { error } = await supabase.from("payment_channels").update({ active: !c.active }).eq("id", c.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["admin-channels"] });
  };
  const remove = async (c: Channel) => {
    if (!confirm(`Delete "${c.label}"?`)) return;
    const { error } = await supabase.from("payment_channels").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-channels"] }); }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ type: "UPI", active: true, priority: 100, min_amount: 100, max_amount: 100000, details: {} })}>
          <Plus className="h-4 w-4 mr-1" /> Add channel
        </Button>
      </div>

      <div className="glass rounded-xl p-4">
        {isLoading && <div className="py-10 text-center"><Loader2 className="h-5 w-5 inline animate-spin" /></div>}
        {data && data.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No deposit channels configured. Add one to start accepting deposits.</p>}
        <div className="grid md:grid-cols-2 gap-3">
          {data?.map((c) => (
            <div key={c.id} className={`rounded-lg border p-4 space-y-2 ${c.active ? "border-border/60" : "border-border/30 opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChannelIcon type={c.type} />
                  <div>
                    <div className="font-semibold">{c.label}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.type} · priority {c.priority}</div>
                  </div>
                </div>
                <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
              </div>
              <div className="text-xs text-muted-foreground font-mono break-all">
                {c.type === "UPI" && c.details.vpa}
                {c.type === "BANK" && `${c.details.account_number ?? ""} · ${c.details.ifsc ?? ""} · ${c.details.bank_name ?? ""}`}
                {c.type === "QR" && (c.qr_image_url ? "QR image uploaded" : "No QR uploaded")}
              </div>
              <div className="text-[11px] text-muted-foreground">
                ₹{Number(c.min_amount).toLocaleString("en-IN")} – ₹{Number(c.max_amount).toLocaleString("en-IN")}
                {c.daily_cap ? ` · cap ₹${Number(c.daily_cap).toLocaleString("en-IN")}/day` : ""}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && <ChannelDialog initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ChannelIcon({ type }: { type: Channel["type"] }) {
  const cls = "h-5 w-5 text-primary";
  return type === "UPI" ? <Smartphone className={cls} /> : type === "BANK" ? <Banknote className={cls} /> : <QrCode className={cls} />;
}

function ChannelDialog({ initial, onClose }: { initial: Partial<Channel>; onClose: () => void }) {
  const qc = useQueryClient();
  const [c, setC] = useState<Partial<Channel>>(initial);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const update = (patch: Partial<Channel>) => setC((s) => ({ ...s, ...patch }));
  const updateDetails = (k: string, v: string) => setC((s) => ({ ...s, details: { ...(s.details ?? {}), [k]: v } }));

  const save = async () => {
    if (!c.label) return toast.error("Label required");
    if (c.type === "UPI" && !c.details?.vpa) return toast.error("UPI VPA required");
    if (c.type === "BANK" && (!c.details?.account_number || !c.details?.ifsc)) return toast.error("Account number + IFSC required");

    setBusy(true);
    try {
      let qr_image_url = c.qr_image_url ?? null;
      if (file) {
        const path = `${crypto.randomUUID()}-${file.name}`;
        const up = await supabase.storage.from("payment-qr").upload(path, file, { upsert: false });
        if (up.error) throw new Error(up.error.message);
        qr_image_url = supabase.storage.from("payment-qr").getPublicUrl(up.data.path).data.publicUrl;
      }
      const payload = {
        type: c.type!, label: c.label!, details: c.details ?? {},
        qr_image_url, instructions: c.instructions ?? null,
        active: c.active ?? true, priority: c.priority ?? 100,
        min_amount: Number(c.min_amount ?? 100), max_amount: Number(c.max_amount ?? 100000),
        daily_cap: c.daily_cap ? Number(c.daily_cap) : null,
      };
      const r = c.id
        ? await supabase.from("payment_channels").update(payload).eq("id", c.id)
        : await supabase.from("payment_channels").insert(payload);
      if (r.error) throw r.error;
      toast.success(c.id ? "Updated" : "Added");
      qc.invalidateQueries({ queryKey: ["admin-channels"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{c.id ? "Edit" : "Add"} deposit channel</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Type</Label>
              <Select value={c.type} onValueChange={(v) => update({ type: v as Channel["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI ID</SelectItem>
                  <SelectItem value="BANK">Bank Account</SelectItem>
                  <SelectItem value="QR">QR Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Input type="number" value={c.priority ?? 100} onChange={(e) => update({ priority: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>Label *</Label>
            <Input value={c.label ?? ""} onChange={(e) => update({ label: e.target.value })} placeholder="e.g. Primary UPI" />
          </div>

          {c.type === "UPI" && (
            <div>
              <Label>UPI VPA *</Label>
              <Input value={c.details?.vpa ?? ""} onChange={(e) => updateDetails("vpa", e.target.value)} placeholder="name@bank" />
            </div>
          )}
          {c.type === "BANK" && (
            <div className="space-y-2">
              <Input value={c.details?.holder ?? ""} onChange={(e) => updateDetails("holder", e.target.value)} placeholder="Holder name" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={c.details?.account_number ?? ""} onChange={(e) => updateDetails("account_number", e.target.value)} placeholder="Account number *" />
                <Input value={c.details?.ifsc ?? ""} onChange={(e) => updateDetails("ifsc", e.target.value.toUpperCase())} placeholder="IFSC *" />
              </div>
              <Input value={c.details?.bank_name ?? ""} onChange={(e) => updateDetails("bank_name", e.target.value)} placeholder="Bank name" />
            </div>
          )}
          {(c.type === "QR" || c.type === "UPI") && (
            <div>
              <Label className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> QR image {c.type === "QR" ? "*" : "(optional)"}</Label>
              {c.qr_image_url && <img src={c.qr_image_url} alt="QR" className="mt-2 h-24 w-24 object-contain rounded border border-border/60" />}
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div><Label>Min ₹</Label><Input type="number" value={c.min_amount ?? 100} onChange={(e) => update({ min_amount: Number(e.target.value) })} /></div>
            <div><Label>Max ₹</Label><Input type="number" value={c.max_amount ?? 100000} onChange={(e) => update({ max_amount: Number(e.target.value) })} /></div>
            <div><Label>Daily cap ₹</Label><Input type="number" value={c.daily_cap ?? ""} onChange={(e) => update({ daily_cap: e.target.value ? Number(e.target.value) : null })} /></div>
          </div>
          <div>
            <Label>Instructions (shown to users)</Label>
            <Textarea rows={2} value={c.instructions ?? ""} onChange={(e) => update({ instructions: e.target.value })} placeholder="e.g. Pay only via this UPI between 9 AM – 11 PM" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={c.active ?? true} onCheckedChange={(v) => update({ active: v })} />
            <span className="text-sm">Active</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Withdrawal methods -------------------- */

function MethodsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Method> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_methods").select("*")
        .order("priority").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Method[];
    },
  });

  const toggleActive = async (m: Method) => {
    const { error } = await supabase.from("withdrawal_methods").update({ active: !m.active }).eq("id", m.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["admin-methods"] });
  };
  const remove = async (m: Method) => {
    if (!confirm(`Delete "${m.label}"?`)) return;
    const { error } = await supabase.from("withdrawal_methods").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-methods"] }); }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ type: "UPI", active: true, priority: 100, min_amount: 500, max_amount: 100000, fee_pct: 0, label: "" })}>
          <Plus className="h-4 w-4 mr-1" /> Add method
        </Button>
      </div>

      <div className="glass rounded-xl p-4">
        {isLoading && <div className="py-10 text-center"><Loader2 className="h-5 w-5 inline animate-spin" /></div>}
        {data && data.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No withdrawal methods configured.</p>}
        <div className="grid md:grid-cols-2 gap-3">
          {data?.map((m) => (
            <div key={m.id} className={`rounded-lg border p-4 space-y-1 ${m.active ? "border-border/60" : "border-border/30 opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {m.type === "UPI" ? <Smartphone className="h-5 w-5 text-primary" /> : <Banknote className="h-5 w-5 text-primary" />}
                  <div>
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{m.type} · priority {m.priority}</div>
                  </div>
                </div>
                <Switch checked={m.active} onCheckedChange={() => toggleActive(m)} />
              </div>
              <div className="text-[11px] text-muted-foreground">
                ₹{Number(m.min_amount).toLocaleString("en-IN")} – ₹{Number(m.max_amount).toLocaleString("en-IN")} · fee {Number(m.fee_pct)}%
              </div>
              {m.instructions && <p className="text-xs text-muted-foreground">{m.instructions}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(m)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(m)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && <MethodDialog initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MethodDialog({ initial, onClose }: { initial: Partial<Method>; onClose: () => void }) {
  const qc = useQueryClient();
  const [m, setM] = useState<Partial<Method>>(initial);
  const [busy, setBusy] = useState(false);
  const update = (p: Partial<Method>) => setM((s) => ({ ...s, ...p }));

  const save = async () => {
    if (!m.label) return toast.error("Label required");
    setBusy(true);
    try {
      const payload = {
        type: m.type!, label: m.label!, active: m.active ?? true,
        min_amount: Number(m.min_amount ?? 500), max_amount: Number(m.max_amount ?? 100000),
        fee_pct: Number(m.fee_pct ?? 0), instructions: m.instructions ?? null,
        priority: Number(m.priority ?? 100),
      };
      const r = m.id
        ? await supabase.from("withdrawal_methods").update(payload).eq("id", m.id)
        : await supabase.from("withdrawal_methods").insert(payload);
      if (r.error) throw r.error;
      toast.success(m.id ? "Updated" : "Added");
      qc.invalidateQueries({ queryKey: ["admin-methods"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{m.id ? "Edit" : "Add"} withdrawal method</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Type</Label>
              <Select value={m.type} onValueChange={(v) => update({ type: v as Method["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="BANK">Bank Account</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Input type="number" value={m.priority ?? 100} onChange={(e) => update({ priority: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>Label *</Label>
            <Input value={m.label ?? ""} onChange={(e) => update({ label: e.target.value })} placeholder="e.g. UPI Transfer" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Min ₹</Label><Input type="number" value={m.min_amount ?? 500} onChange={(e) => update({ min_amount: Number(e.target.value) })} /></div>
            <div><Label>Max ₹</Label><Input type="number" value={m.max_amount ?? 100000} onChange={(e) => update({ max_amount: Number(e.target.value) })} /></div>
            <div><Label>Fee %</Label><Input type="number" step="0.1" value={m.fee_pct ?? 0} onChange={(e) => update({ fee_pct: Number(e.target.value) })} /></div>
          </div>
          <div>
            <Label>Instructions</Label>
            <Textarea rows={2} value={m.instructions ?? ""} onChange={(e) => update({ instructions: e.target.value })} placeholder="e.g. Processed within 2 hours on working days" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={m.active ?? true} onCheckedChange={(v) => update({ active: v })} />
            <span className="text-sm">Active</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
