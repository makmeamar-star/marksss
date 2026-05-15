import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getMissingResults } from "@/lib/missingResults.functions";

export function MissingResultsBanner() {
  const fetchMissing = useServerFn(getMissingResults);
  const q = useQuery({
    queryKey: ["admin", "missing-results"],
    queryFn: () => fetchMissing(),
    refetchInterval: 60_000,
  });

  const rows = q.data?.rows ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="font-semibold text-sm">
          {rows.length} result{rows.length === 1 ? "" : "s"} need manual declaration
        </h3>
      </div>
      <ul className="grid sm:grid-cols-2 gap-2">
        {rows.slice(0, 8).map((r) => (
          <li key={`${r.market_id}-${r.session}`}>
            <Link
              to="/admin/results/declare"
              search={{ market: r.market_id, session: r.session } as never}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm hover:border-destructive/60 transition-colors"
            >
              <span className="truncate">
                <span className="font-medium">{r.display_name}</span>
                <span className="text-muted-foreground ml-1">
                  · {r.session.toLowerCase()} @ {r.scheduled_time}
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-destructive">
                  {r.minutes_overdue}m late
                </span>
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > 8 && (
        <p className="text-xs text-muted-foreground mt-2">
          + {rows.length - 8} more
        </p>
      )}
    </div>
  );
}
