import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldX, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type DiagCheck = { name: string; ok: boolean; detail: string };
type DiagPayload = { checks: DiagCheck[]; at: string };

export const Route = createFileRoute("/admin-forbidden")({
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === "string" ? s.from : "",
  }),
  head: () => ({ meta: [{ title: "Admin Access — Forbidden" }] }),
  component: ForbiddenPage,
});

function ForbiddenPage() {
  const { from } = Route.useSearch();
  const [diag, setDiag] = useState<DiagPayload | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("admin_access_diag");
      if (raw) setDiag(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-background px-6 py-10 flex items-start justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/15 text-destructive">
            <ShieldX className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-display font-bold">403 — Admin Access Denied</h1>
          <p className="text-muted-foreground text-sm">
            Below is the result of every check the admin gate ran for this session.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <span className="text-sm font-semibold">Access checks</span>
            <span className="text-[11px] text-muted-foreground">
              {diag?.at ? new Date(diag.at).toLocaleString() : "no data"}
            </span>
          </div>

          {diag?.checks?.length ? (
            <ul className="divide-y divide-border/60">
              {diag.checks.map((c, i) => (
                <li key={i} className="px-4 py-3 flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                      c.ok
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground break-all font-mono">
                      {c.detail}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold ${
                      c.ok ? "text-emerald-500" : "text-destructive"
                    }`}
                  >
                    {c.ok ? "PASS" : "FAIL"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No diagnostic data available. Try opening an admin page again.
            </div>
          )}

          {from ? (
            <div className="px-4 py-2 border-t border-border/60 text-[11px] text-muted-foreground break-all">
              Attempted: <span className="font-mono">{from}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => {
              if (from) window.location.href = from;
              else window.location.reload();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" /> Retry
          </Button>
          <Button asChild>
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
