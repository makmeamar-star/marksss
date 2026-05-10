interface Props {
  className?: string;
  label?: string;
}

/**
 * Ornamental rangoli/petal divider strip.
 * Pure CSS via .rangoli-divider utility — semantic-token only.
 */
export function RangoliDivider({ className = "", label }: Props) {
  if (label) {
    return (
      <div className={`flex items-center gap-3 ${className}`} aria-hidden>
        <div className="flex-1 rangoli-divider" />
        <span className="font-devanagari text-xs uppercase tracking-[0.4em] text-primary/80 whitespace-nowrap">
          {label}
        </span>
        <div className="flex-1 rangoli-divider" />
      </div>
    );
  }
  return <div className={`rangoli-divider ${className}`} aria-hidden />;
}
