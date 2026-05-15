import { Bell, BellOff, BellRing } from "lucide-react";
import { useResultAlerts } from "@/hooks/useResultAlerts";
import { cn } from "@/lib/utils";

interface Props {
  marketId: string;
  className?: string;
}

export function ResultAlertBell({ marketId, className }: Props) {
  const { support, enabledIds, toggle, isToggling, permission } = useResultAlerts();
  const enabled = enabledIds.has(marketId);

  if (!support.supported) {
    if (support.reason === "preview") return null; // hide in editor preview
    return (
      <button
        type="button"
        disabled
        title="Push notifications not supported on this device"
        className={cn(
          "p-1.5 rounded-md text-muted-foreground/40 cursor-not-allowed",
          className,
        )}
      >
        <BellOff className="w-4 h-4" />
      </button>
    );
  }

  const denied = permission === "denied";
  const Icon = denied ? BellOff : enabled ? BellRing : Bell;

  return (
    <button
      type="button"
      disabled={isToggling || denied}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle(marketId, !enabled);
      }}
      title={
        denied
          ? "Notifications blocked — enable in browser settings"
          : enabled
            ? "Result alerts on — tap to disable"
            : "Get notified when this result is declared"
      }
      aria-label={enabled ? "Disable result alerts" : "Enable result alerts"}
      aria-pressed={enabled}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        enabled
          ? "text-primary hover:bg-primary/10"
          : "text-muted-foreground hover:text-primary hover:bg-primary/5",
        denied && "text-muted-foreground/50 cursor-not-allowed",
        className,
      )}
    >
      <Icon className={cn("w-4 h-4", enabled && "drop-shadow-[0_0_4px_hsl(var(--primary))]")} />
    </button>
  );
}
