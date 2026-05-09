import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, ArrowRight, Zap, Wallet, ArrowDownToLine, History, FileSearch, Store } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

const tiles = [
  {
    to: "/admin/markets" as const,
    icon: Store,
    title: "Manage Markets",
    desc: "Add, edit, suspend, or remove games (markets) from the platform.",
  },
  {
    to: "/admin/results/declare" as const,
    icon: Trophy,
    title: "Declare Results",
    desc: "Enter Open/Close pana with full validation, financial impact preview, and 10-min correction window.",
  },
  {
    to: "/admin/results/automation" as const,
    icon: Zap,
    title: "Result Automation",
    desc: "Toggle automatic result declaration per market. Scheduler runs every minute.",
  },
  {
    to: "/admin/results/automation-runs" as const,
    icon: History,
    title: "Automation Runs",
    desc: "Audit log of recent auto-declared sessions, picks, and payouts.",
  },
  {
    to: "/admin/results/automation-audit" as const,
    icon: FileSearch,
    title: "Automation Audit",
    desc: "Search and filter every AUTO_DECLARE event by market, date, or session.",
  },
  {
    to: "/admin/deposits" as const,
    icon: Wallet,
    title: "Deposit Requests",
    desc: "Review and approve pending user deposits.",
  },
  {
    to: "/admin/withdrawals" as const,
    icon: ArrowDownToLine,
    title: "Withdrawal Requests",
    desc: "Approve or reject withdrawal requests.",
  },
];

function AdminHome() {
  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <h1 className="font-display text-4xl font-bold">Admin Dashboard</h1>
      <p className="text-muted-foreground mt-2">Operations control center.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group flex items-start justify-between gap-4 rounded-2xl glass-gold p-5 hover:ring-gold transition-all"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-background shrink-0">
                <t.icon className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-lg font-bold">{t.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform mt-2 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
