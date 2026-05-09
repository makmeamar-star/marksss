import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/markets")({
  component: MarketsAdmin,
});

type Market = {
  id: string;
  name: string;
  display_name: string;
  open_time: string;
  close_time: string;
  result_time: string;
  days: string[];
  min_bet: number;
  max_bet: number;
  status: string;
  payouts: Record<string, number>;
};

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DEFAULT_PAYOUTS = {
  single: 9, jodi: 90, singlePana: 150, doublePana: 300,
  triplePana: 600, halfSangam: 1000, fullSangam: 10000,
};

function emptyForm(): Market {
  return {
    id: "", name: "", display_name: "",
    open_time: "10:00", close_time: "12:00", result_time: "12:15",
    days: [...ALL_DAYS], min_bet: 10, max_bet: 10000,
    status: "ACTIVE", payouts: { ...DEFAULT_PAYOUTS },
  };
}

function MarketsAdmin() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Market | null>(null);
  const [form, setForm] = useState<Market>(emptyForm());
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("markets").select("*").order("display_name");
    if (error) toast.error(error.message);
    else setMarkets((data ?? []) as Market[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }
  function openEdit(m: Market) {
    setEditing(m);
    setForm({ ...m, payouts: { ...DEFAULT_PAYOUTS, ...m.payouts } });
    setOpen(true);
  }

  async function save() {
    if (!/^[a-z0-9-]+$/.test(form.id)) {
      toast.error("ID must be lowercase letters, digits, or dashes");
      return;
    }
    if (!form.display_name.trim()) {
      toast.error("Display name required");
      return;
    }
    if (form.open_time >= form.close_time) {
      toast.error("Open time must be before close time");
      return;
    }
    if (form.days.length === 0) {
      toast.error("Select at least one day");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      name: form.name || form.display_name,
      min_bet: Number(form.min_bet),
      max_bet: Number(form.max_bet),
    };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from("markets")
        .update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("markets").insert(payload));
      if (!err) {
        await supabase.from("market_automation").upsert({
          market_id: form.id, open_enabled: false, close_enabled: false,
          mode: "RANDOM", grace_minutes: 1,
        });
      }
    }
    setSaving(false);
    if (err) { toast.error(err.message); return; }
    toast.success(editing ? "Market updated" : "Market created");
    setOpen(false);
    load();
  }

  async function toggleStatus(m: Market) {
    const next = m.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const { error } = await supabase.from("markets")
      .update({ status: next }).eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success(`${m.display_name} → ${next}`); load(); }
  }

  async function remove(m: Market) {
    if (!confirm(`Delete "${m.display_name}"? If it has bets or results it will be deactivated instead.`)) return;
    const { data, error } = await supabase.rpc("admin_delete_market", { _market_id: m.id });
    if (error) { toast.error(error.message); return; }
    const soft = (data as { soft?: boolean })?.soft;
    toast.success(soft ? "Market deactivated (has history)" : "Market deleted");
    load();
  }

  return (
    <div className="container mx-auto px-6 py-10 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Manage Markets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add, edit, suspend, or remove games.
          </p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Market</Button>
      </div>

      <div className="mt-6 rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Market</th>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Days</th>
                <th className="text-left px-4 py-3">Bet Range</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && markets.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No markets yet.</td></tr>
              )}
              {markets.map((m) => (
                <tr key={m.id} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{m.display_name}</div>
                    <div className="text-xs text-muted-foreground">{m.id}</div>
                  </td>
                  <td className="px-4 py-3">{m.open_time} – {m.close_time}</td>
                  <td className="px-4 py-3 text-xs">{m.days.join(", ")}</td>
                  <td className="px-4 py-3">₹{m.min_bet} – ₹{m.max_bet}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      m.status === "ACTIVE"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => toggleStatus(m)} title="Toggle status">
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(m)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(m)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.display_name}` : "Add Market"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>ID (slug)</Label>
              <Input value={form.id} disabled={!!editing}
                onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase() })}
                placeholder="kalyan-night" />
            </div>
            <div>
              <Label>Display Name</Label>
              <Input value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Kalyan Night" />
            </div>
            <div>
              <Label>Open Time</Label>
              <Input type="time" value={form.open_time}
                onChange={(e) => setForm({ ...form, open_time: e.target.value })} />
            </div>
            <div>
              <Label>Close Time</Label>
              <Input type="time" value={form.close_time}
                onChange={(e) => setForm({ ...form, close_time: e.target.value })} />
            </div>
            <div>
              <Label>Result Time</Label>
              <Input type="time" value={form.result_time}
                onChange={(e) => setForm({ ...form, result_time: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div>
              <Label>Min Bet (₹)</Label>
              <Input type="number" value={form.min_bet}
                onChange={(e) => setForm({ ...form, min_bet: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Max Bet (₹)</Label>
              <Input type="number" value={form.max_bet}
                onChange={(e) => setForm({ ...form, max_bet: Number(e.target.value) })} />
            </div>
          </div>

          <div className="mt-2">
            <Label className="mb-2 block">Days Active</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((d) => {
                const on = form.days.includes(d);
                return (
                  <button key={d} type="button"
                    onClick={() => setForm({
                      ...form,
                      days: on ? form.days.filter(x => x !== d) : [...form.days, d],
                    })}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      on ? "bg-primary/15 text-primary border-primary/40"
                         : "border-border/60 text-muted-foreground"
                    }`}>{d}</button>
                );
              })}
            </div>
          </div>

          <div className="mt-2">
            <Label className="mb-2 block">Payouts</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.keys(DEFAULT_PAYOUTS).map((k) => (
                <div key={k}>
                  <Label className="text-xs text-muted-foreground">{k}</Label>
                  <Input type="number" value={form.payouts[k] ?? 0}
                    onChange={(e) => setForm({
                      ...form,
                      payouts: { ...form.payouts, [k]: Number(e.target.value) },
                    })} />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Market"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
