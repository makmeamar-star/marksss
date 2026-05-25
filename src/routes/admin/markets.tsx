import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Power, RefreshCw, Settings2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useHomeMarketCount,
  setHomeMarketCount,
  MIN_HOME_MARKET_COUNT,
  MAX_HOME_MARKET_COUNT,
} from "@/hooks/useHomeMarketCount";

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
  is_core: boolean;
  payouts: Record<string, number>;
};

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const FALLBACK_PAYOUTS = {
  single: 9, jodi: 90, singlePana: 150, doublePana: 300,
  triplePana: 600, halfSangam: 1000, fullSangam: 10000,
};

function emptyForm(defaults: Record<string, number>): Market {
  return {
    id: "", name: "", display_name: "",
    open_time: "10:00", close_time: "12:00", result_time: "12:15",
    days: [...ALL_DAYS], min_bet: 10, max_bet: 10000,
    status: "ACTIVE", is_core: false, payouts: { ...defaults },
  };
}

function MarketsAdmin() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [defaultPayouts, setDefaultPayouts] = useState<Record<string, number>>(FALLBACK_PAYOUTS);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [defaultsForm, setDefaultsForm] = useState<Record<string, number>>(FALLBACK_PAYOUTS);
  const [applyToAll, setApplyToAll] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Market | null>(null);
  const [form, setForm] = useState<Market>(emptyForm(FALLBACK_PAYOUTS));
  const [saving, setSaving] = useState(false);

  const [backfilling, setBackfilling] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: ms, error: e1 }, { data: settings }] = await Promise.all([
      supabase.from("markets").select("*").order("display_name"),
      supabase.from("app_settings").select("value").eq("key", "default_payouts").maybeSingle(),
    ]);
    if (e1) toast.error(e1.message);
    else setMarkets((ms ?? []) as Market[]);
    if (settings?.value) {
      const v = settings.value as Record<string, number>;
      setDefaultPayouts({ ...FALLBACK_PAYOUTS, ...v });
      setDefaultsForm({ ...FALLBACK_PAYOUTS, ...v });
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter((m) =>
      m.display_name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [markets, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));

  function toggleSelect(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }
  function toggleSelectAll() {
    if (allFilteredSelected) {
      const next = new Set(selected);
      filtered.forEach((m) => next.delete(m.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((m) => next.add(m.id));
      setSelected(next);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm(defaultPayouts));
    setOpen(true);
  }
  function openEdit(m: Market) {
    setEditing(m);
    setForm({ ...m, payouts: { ...defaultPayouts, ...m.payouts } });
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

  async function bulkSetStatus(status: "ACTIVE" | "INACTIVE") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Set ${ids.length} market(s) to ${status}?`)) return;
    setBulkBusy(true);
    const { error } = await supabase.from("markets").update({ status }).in("id", ids);
    setBulkBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} market(s) → ${status}`); setSelected(new Set()); load(); }
  }

  async function remove(m: Market) {
    if (!confirm(`Delete "${m.display_name}"? If it has bets or results it will be deactivated instead.`)) return;
    const { data, error } = await supabase.rpc("admin_delete_market", { _market_id: m.id });
    if (error) { toast.error(error.message); return; }
    const soft = (data as { soft?: boolean })?.soft;
    toast.success(soft ? "Market deactivated (has history)" : "Market deleted");
    load();
  }

  async function backfillOne(m: Market) {
    setBackfilling(m.id);
    try {
      const res = await fetch("/api/public/hooks/backfill-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketIds: [m.id] }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "backfill failed");
      toast.success(`Backfilled ${m.display_name} — ${json.written} rows`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBackfilling(null);
    }
  }

  async function saveDefaults() {
    setSavingDefaults(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "default_payouts", value: defaultsForm, updated_at: new Date().toISOString() });
    if (error) { setSavingDefaults(false); toast.error(error.message); return; }
    setDefaultPayouts({ ...defaultsForm });

    if (applyToAll) {
      const { error: e2 } = await supabase
        .from("markets")
        .update({ payouts: defaultsForm })
        .neq("id", "");
      if (e2) { setSavingDefaults(false); toast.error(e2.message); return; }
      toast.success("Defaults saved and applied to all markets");
    } else {
      toast.success("Default payouts saved");
    }
    setSavingDefaults(false);
    setDefaultsOpen(false);
    load();
  }

  return (
    <div className="container mx-auto px-6 py-10 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Manage Markets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add, edit, suspend, or remove games. {markets.length} total · {markets.filter((m) => m.status === "ACTIVE").length} active.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setDefaultsForm(defaultPayouts); setApplyToAll(false); setDefaultsOpen(true); }}>
            <Settings2 className="h-4 w-4 mr-2" />Default Payouts
          </Button>
          <HomeMarketCountControl />
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Market</Button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search markets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {selected.size > 0 && (
          <>
            <span className="text-sm text-muted-foreground ml-2">{selected.size} selected</span>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkSetStatus("ACTIVE")}>
              Activate
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkSetStatus("INACTIVE")}>
              Deactivate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 w-10">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} />
                </th>
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
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No markets match.</td></tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id} className="border-t border-border/60">
                  <td className="px-3 py-3">
                    <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} />
                  </td>
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
                      <Button size="icon" variant="ghost" disabled={backfilling === m.id} onClick={() => backfillOne(m)} title="Backfill from source">
                        {backfilling === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
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

      {/* Add/Edit market dialog */}
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
              {Object.keys(FALLBACK_PAYOUTS).map((k) => (
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

      {/* Default payouts dialog */}
      <Dialog open={defaultsOpen} onOpenChange={setDefaultsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Default Payouts</DialogTitle>
            <DialogDescription>
              Used for new markets by default. Optionally apply to every existing market.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {Object.keys(FALLBACK_PAYOUTS).map((k) => (
              <div key={k}>
                <Label className="text-xs text-muted-foreground">{k}</Label>
                <Input type="number" value={defaultsForm[k] ?? 0}
                  onChange={(e) => setDefaultsForm({ ...defaultsForm, [k]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Checkbox id="apply-all" checked={applyToAll} onCheckedChange={(v) => setApplyToAll(!!v)} />
            <label htmlFor="apply-all" className="text-sm cursor-pointer">
              Also apply to all {markets.length} existing markets
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDefaultsOpen(false)}>Cancel</Button>
            <Button onClick={saveDefaults} disabled={savingDefaults}>
              {savingDefaults ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HomeMarketCountControl() {
  const current = useHomeMarketCount();
  const [value, setValue] = useState<string>(String(current));
  useEffect(() => { setValue(String(current)); }, [current]);
  const commit = () => {
    const n = setHomeMarketCount(Number(value));
    setValue(String(n));
    toast.success(`Homepage will show ${n} market${n === 1 ? "" : "s"}`);
  };
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="home-market-count" className="text-xs text-muted-foreground whitespace-nowrap">
        Homepage markets
      </Label>
      <Input
        id="home-market-count"
        type="number"
        min={MIN_HOME_MARKET_COUNT}
        max={MAX_HOME_MARKET_COUNT}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-20"
      />
      <span className="text-xs text-muted-foreground">/ {MAX_HOME_MARKET_COUNT}</span>
    </div>
  );
}
