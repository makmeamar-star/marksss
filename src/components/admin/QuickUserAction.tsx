import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Wallet, Ban, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listUsers, adjustBalance, setUserStatus } from "@/lib/adminUsers.functions";

const inr = (n: number | null | undefined) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

type Row = {
  user_id: string;
  username: string;
  email: string | null;
  balance: number;
  status: string;
};

export function QuickUserAction() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const credit = useServerFn(adjustBalance);
  const status = useServerFn(setUserStatus);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<Row | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const q = useQuery({
    queryKey: ["admin", "quick-user-search", debounced],
    queryFn: () => list({ data: { search: debounced, page: 1, pageSize: 8 } }),
    enabled: debounced.length >= 2,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "quick-user-search"] });
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "overview"] });
  };

  const creditMut = useMutation({
    mutationFn: (vars: { delta: number; reason: string }) =>
      credit({ data: { userId: picked!.user_id, ...vars } }),
    onSuccess: () => {
      toast.success("Funds added");
      setAmount(""); setReason("");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: (next: "ACTIVE" | "SUSPENDED") =>
      status({
        data: {
          userId: picked!.user_id,
          status: next,
          reason: reason.trim() || (next === "SUSPENDED" ? "Banned from dashboard" : "Reactivated from dashboard"),
        },
      }),
    onSuccess: (_d, next) => {
      toast.success(next === "SUSPENDED" ? "User banned" : "User reactivated");
      setPicked((p) => (p ? { ...p, status: next } : p));
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const addFunds = () => {
    if (!picked) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a positive amount");
    if (reason.trim().length < 3) return toast.error("Reason is required (min 3 chars)");
    creditMut.mutate({ delta: n, reason: reason.trim() });
  };

  const isSuspended = picked?.status === "SUSPENDED";

  const rows = useMemo(() => (q.data?.rows ?? []) as Row[], [q.data]);

  return (
    <div className="rounded-2xl glass-gold p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold mb-3">Quick user action</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search username, email, phone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPicked(null); }}
          className="pl-9"
          maxLength={120}
        />
      </div>

      {debounced.length >= 2 && !picked && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border/40">
          {q.isLoading ? (
            <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching…
            </div>
          ) : rows.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No users found.</div>
          ) : (
            rows.map((u) => (
              <button
                key={u.user_id}
                onClick={() => setPicked(u)}
                className="w-full text-left px-3 py-2 hover:bg-background/40 border-b border-border/30 last:border-0"
              >
                <div className="text-sm font-medium">{u.username}</div>
                <div className="text-xs text-muted-foreground flex justify-between gap-2">
                  <span className="truncate">{u.email ?? "—"}</span>
                  <span className="font-mono shrink-0">{inr(u.balance)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {picked && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-background/30 px-3 py-2">
            <div>
              <div className="text-sm font-medium">{picked.username}</div>
              <div className="text-xs text-muted-foreground">
                {picked.email ?? "—"} · Balance <span className="font-mono">{inr(picked.balance)}</span>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              isSuspended
                ? "border-destructive/40 text-destructive bg-destructive/10"
                : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
            }`}>{picked.status}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number" min={1} max={10_000_000} value={amount}
                onChange={(e) => setAmount(e.target.value)} placeholder="500"
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" size="sm" onClick={addFunds} disabled={creditMut.isPending}>
                <Wallet className="h-4 w-4 mr-1.5" />
                {creditMut.isPending ? "Adding…" : "Add funds"}
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Reason (required for funds, optional for ban)</Label>
            <Textarea
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Refund for failed deposit"
              rows={2} maxLength={200}
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm" className="flex-1"
              variant={isSuspended ? "default" : "destructive"}
              onClick={() => statusMut.mutate(isSuspended ? "ACTIVE" : "SUSPENDED")}
              disabled={statusMut.isPending}
            >
              {isSuspended ? <RotateCcw className="h-4 w-4 mr-1.5" /> : <Ban className="h-4 w-4 mr-1.5" />}
              {statusMut.isPending
                ? "Working…"
                : isSuspended ? "Unban user" : "Ban user"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setSearch(""); setAmount(""); setReason(""); }}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {debounced.length < 2 && !picked && (
        <p className="mt-2 text-[11px] text-muted-foreground">Type at least 2 characters to search.</p>
      )}
    </div>
  );
}
