import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Search, ChevronLeft, ChevronRight, Shield, ShieldOff,
  Wallet, Ban, RotateCcw, User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  listUsers, getUserDetail, setAdminRole, adjustBalance, setUserStatus,
} from "@/lib/adminUsers.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

const inr = (n: number | null | undefined) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function AdminUsersPage() {
  const list = useServerFn(listUsers);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [selected, setSelected] = useState<string | null>(null);

  // simple debounce
  useMemo(() => {
    const id = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const q = useQuery({
    queryKey: ["admin", "users", debounced, page],
    queryFn: () => list({ data: { search: debounced, page, pageSize } }),
  });

  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
      <h1 className="font-display text-3xl font-bold">Users</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Search, audit, and manage every player on the platform.
      </p>

      <div className="mt-5 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search username, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            maxLength={120}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {q.isLoading ? "Loading…" : `${total} user${total === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="mt-4 rounded-2xl glass-gold overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="text-xs text-muted-foreground bg-background/30">
              <tr className="text-left">
                <th className="px-3 py-2.5 font-medium">User</th>
                <th className="px-3 py-2.5 font-medium">Balance</th>
                <th className="px-3 py-2.5 font-medium">Total bet</th>
                <th className="px-3 py-2.5 font-medium">Total win</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Role</th>
                <th className="px-3 py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.rows ?? []).map((u: any) => (
                <tr
                  key={u.user_id}
                  onClick={() => setSelected(u.user_id)}
                  className="border-t border-border/40 hover:bg-background/40 cursor-pointer"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{u.username}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[260px]">{u.email ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono">{inr(u.balance)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{inr(u.total_bet)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{inr(u.total_win)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      u.status === "SUSPENDED"
                        ? "border-destructive/40 text-destructive bg-destructive/10"
                        : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    }`}>{u.status}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {u.isAdmin ? (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-primary/40 text-primary bg-primary/10">admin</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">user</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))}
              {!q.isLoading && (q.data?.rows ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-border/40">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {selected && (
        <UserDrawer userId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useServerFn(getUserDetail);
  const roleFn = useServerFn(setAdminRole);
  const balFn = useServerFn(adjustBalance);
  const statusFn = useServerFn(setUserStatus);

  const q = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () => detail({ data: { userId } }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "user", userId] });
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const roleMut = useMutation({
    mutationFn: (grant: boolean) => roleFn({ data: { userId, grant } }),
    onSuccess: (_d, grant) => { toast.success(grant ? "Admin role granted" : "Admin role revoked"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { status: "ACTIVE" | "SUSPENDED"; reason: string }) =>
      statusFn({ data: { userId, ...vars } }),
    onSuccess: (_d, v) => { toast.success(v.status === "SUSPENDED" ? "User suspended" : "User reactivated"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const balMut = useMutation({
    mutationFn: (vars: { delta: number; reason: string }) =>
      balFn({ data: { userId, ...vars } }),
    onSuccess: () => { toast.success("Balance adjusted"); refresh(); setBalOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const [balOpen, setBalOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const p = q.data?.profile;
  const isAdmin = (q.data?.roles ?? []).includes("admin");
  const isSuspended = p?.status === "SUSPENDED";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" />
            {p?.username ?? "User"}
          </SheetTitle>
        </SheetHeader>

        {q.isLoading && <p className="text-sm text-muted-foreground mt-6">Loading…</p>}

        {p && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Email" value={p.email ?? "—"} />
              <Field label="Phone" value={p.phone ?? "—"} />
              <Field label="Balance" value={inr(p.balance)} mono />
              <Field label="Status" value={p.status} />
              <Field label="KYC" value={p.kyc_status} />
              <Field label="Role" value={isAdmin ? "admin" : "user"} />
              <Field label="Total bet" value={inr(p.total_bet)} mono />
              <Field label="Total win" value={inr(p.total_win)} mono />
              <Field label="Total deposit" value={inr(p.total_deposit)} mono />
              <Field label="Total withdraw" value={inr(p.total_withdraw)} mono />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setBalOpen(true)}>
                <Wallet className="h-4 w-4 mr-1.5" /> Adjust balance
              </Button>
              <Button
                size="sm"
                variant={isAdmin ? "outline" : "default"}
                onClick={() => roleMut.mutate(!isAdmin)}
                disabled={roleMut.isPending}
              >
                {isAdmin ? <ShieldOff className="h-4 w-4 mr-1.5" /> : <Shield className="h-4 w-4 mr-1.5" />}
                {isAdmin ? "Revoke admin" : "Grant admin"}
              </Button>
              <Button
                size="sm"
                variant={isSuspended ? "default" : "destructive"}
                onClick={() => setStatusOpen(true)}
              >
                {isSuspended ? <RotateCcw className="h-4 w-4 mr-1.5" /> : <Ban className="h-4 w-4 mr-1.5" />}
                {isSuspended ? "Reactivate" : "Suspend"}
              </Button>
            </div>

            <Section title="Recent bets">
              {(q.data?.bets ?? []).length === 0 ? (
                <Empty>No bets yet.</Empty>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {q.data!.bets.map((b: any) => (
                    <li key={b.id} className="flex justify-between border-b border-border/30 py-1.5">
                      <span className="truncate">
                        <span className="font-mono">{b.bet_type}</span> {b.bet_number} · {b.market_id}
                      </span>
                      <span className={`font-mono ${b.status === "WON" ? "text-emerald-400" : b.status === "LOST" ? "text-muted-foreground" : "text-primary"}`}>
                        {inr(b.amount)} · {b.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Recent transactions">
              {(q.data?.transactions ?? []).length === 0 ? (
                <Empty>No transactions yet.</Empty>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {q.data!.transactions.map((t: any) => (
                    <li key={t.id} className="flex justify-between border-b border-border/30 py-1.5">
                      <span className="truncate">{t.type} · {t.description ?? ""}</span>
                      <span className={`font-mono ${Number(t.amount) >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                        {Number(t.amount) >= 0 ? "+" : ""}{inr(Math.abs(Number(t.amount)))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}

        <BalanceDialog
          open={balOpen}
          onOpenChange={setBalOpen}
          loading={balMut.isPending}
          onSubmit={(delta, reason) => balMut.mutate({ delta, reason })}
        />
        <StatusDialog
          open={statusOpen}
          onOpenChange={setStatusOpen}
          loading={statusMut.isPending}
          isSuspended={isSuspended}
          onSubmit={(reason) =>
            statusMut.mutate({ status: isSuspended ? "ACTIVE" : "SUSPENDED", reason })
          }
        />
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold mb-2 text-muted-foreground uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function BalanceDialog({
  open, onOpenChange, loading, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loading: boolean;
  onSubmit: (delta: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [reason, setReason] = useState("");

  const submit = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a positive amount");
    if (reason.trim().length < 3) return toast.error("Reason is required (min 3 chars)");
    onSubmit(direction === "credit" ? n : -n, reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust balance</DialogTitle>
          <DialogDescription>This is logged to the audit trail and the wallet ledger.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={direction === "credit" ? "default" : "outline"}
              onClick={() => setDirection("credit")}
            >Credit (+)</Button>
            <Button
              size="sm"
              variant={direction === "debit" ? "destructive" : "outline"}
              onClick={() => setDirection("debit")}
            >Debit (−)</Button>
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input
              type="number" min={1} max={10_000_000} value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
            />
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Refund for failed deposit on 2026-05-09"
              maxLength={200} rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Submitting…" : `Confirm ${direction}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({
  open, onOpenChange, loading, isSuspended, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loading: boolean;
  isSuspended: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSuspended ? "Reactivate user" : "Suspend user"}</DialogTitle>
          <DialogDescription>
            {isSuspended
              ? "Restores the user's ability to place bets and use the platform."
              : "Suspended users cannot place new bets. Their balance and history are preserved."}
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>Reason</Label>
          <Textarea
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Suspicious betting pattern flagged on 2026-05-09"
            maxLength={200} rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={isSuspended ? "default" : "destructive"}
            onClick={() => {
              if (reason.trim().length < 3) return toast.error("Reason is required (min 3 chars)");
              onSubmit(reason.trim());
            }}
            disabled={loading}
          >
            {loading ? "Submitting…" : isSuspended ? "Reactivate" : "Suspend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
