import { HEALTHY_MARGIN_PCT } from '../config/finance';
import { formatPercent } from '../utils/format';

/**
 * Compact margin tag. Colour gives a quick hint (green healthy, amber thin,
 * red loss), and the number with its sign always carries the meaning.
 */
export function MarginBadge({ value }: { value: number | null }) {
  let tone = 'bg-surface-muted text-ink-muted';
  if (value !== null) {
    if (value < 0) tone = 'bg-negative/12 text-negative';
    else if (value < HEALTHY_MARGIN_PCT) tone = 'bg-caution/15 text-caution';
    else tone = 'bg-positive/12 text-positive';
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums ${tone}`}>
      {formatPercent(value)}
    </span>
  );
}
