import type { ReactNode } from 'react';
import { Sparkline } from './Sparkline';

export type KpiAccent = 'income' | 'expense' | 'net' | 'margin';

interface KpiCardProps {
  label: string;
  value: string;
  /** Shown on hover, e.g. the exact amount. */
  fullValue?: string;
  hint?: ReactNode;
  accent: KpiAccent;
  /** Highlighted card (used for Net Revenue, the main result). */
  emphasis?: boolean;
  /** Small tag next to the label, e.g. "Demo". */
  tag?: string;
  /** Values for the small trend line (from the selected period only). */
  trend?: readonly number[];
  /** Colour class for the value text (e.g. for negative amounts). */
  valueClassName?: string;
}

const ACCENT_STYLES: Record<KpiAccent, { box: string; dot: string; line: string }> = {
  income: { box: 'bg-income/15', dot: 'bg-income', line: 'text-income' },
  expense: { box: 'bg-expense/15', dot: 'bg-expense', line: 'text-expense' },
  net: { box: 'bg-on-net', dot: 'bg-net', line: 'text-on-net' },
  margin: { box: 'bg-margin/15', dot: 'bg-margin', line: 'text-margin' },
};

/** One headline number (e.g. Total Income) with a short explanation. */
export function KpiCard({
  label,
  value,
  fullValue,
  hint,
  accent,
  emphasis = false,
  tag,
  trend = [],
  valueClassName = '',
}: KpiCardProps) {
  const style = ACCENT_STYLES[accent];
  const surface = emphasis ? 'border-net bg-net text-on-net' : 'border-line bg-surface text-ink';
  const muted = emphasis ? 'text-on-net/75' : 'text-ink-muted';

  return (
    <div className={`flex min-w-0 flex-col rounded-2xl border p-5 ${surface}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${style.box}`} aria-hidden="true">
          <span className={`size-3 rounded-sm ${style.dot}`} />
        </span>
        <p className={`text-sm font-medium ${muted}`}>{label}</p>
        {tag && (
          <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${emphasis ? 'bg-on-net/10' : 'bg-warn-bg text-warn-ink'}`}>
            {tag}
          </span>
        )}
      </div>
      <p
        className={`mt-3 truncate text-2xl font-bold tracking-tight tabular-nums 2xl:text-[1.7rem] ${valueClassName}`}
        title={fullValue ?? value}
      >
        {value}
      </p>
      <div className="mt-2 flex min-h-7 items-end justify-between gap-3">
        <p className={`text-xs ${muted}`}>{hint}</p>
        <Sparkline values={trend} className={style.line} label={`${label} trend in the selected period`} />
      </div>
    </div>
  );
}
