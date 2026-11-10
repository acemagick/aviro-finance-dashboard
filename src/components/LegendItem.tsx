/** Dot + label used in chart legends. Pass the colour as a Tailwind bg-* class. */
export function LegendItem({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <span className={`size-2 rounded-full ${colorClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}
