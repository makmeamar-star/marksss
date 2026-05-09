export function ShortcutsLegend() {
  const items: [string, string][] = [
    ["Alt+1", "Focus market"],
    ["Alt+2", "Focus pana"],
    ["Alt+D", "Declare"],
    ["Alt+C", "Clear"],
    ["Esc", "Close modal"],
    ["Tab", "Next box"],
    ["Enter", "Submit confirm"],
  ];
  return (
    <div className="mt-4 rounded-lg border border-border/40 bg-card/40 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="uppercase tracking-widest text-[10px]">Shortcuts</span>
      {items.map(([k, v]) => (
        <span key={k}>
          <kbd className="px-1.5 py-0.5 rounded bg-muted/40 border border-border text-foreground font-mono text-[10px] mr-1">{k}</kbd>
          {v}
        </span>
      ))}
    </div>
  );
}
