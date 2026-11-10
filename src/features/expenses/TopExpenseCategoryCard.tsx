import type { ExpenseCategoryTotal } from '../../types/expenses';
import { formatCurrency, formatPercent } from '../../utils/format';
import { categoryColorClass } from './categoryStyles';

/** The category with the highest spend in the current filters. */
export function TopExpenseCategoryCard({ top }: { top: ExpenseCategoryTotal | null }) {
  const width = top && top.sharePct !== null ? Math.min(top.sharePct, 100) : 0;
  return (
    <section aria-label="Top expense category" className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-medium text-ink-muted">Top category</p>
      {top ? (
        <>
          <p className="mt-1 text-2xl leading-tight font-bold tracking-tight text-ink">{top.label}</p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-line-subtle" aria-hidden="true">
            <div className={`h-full rounded-full ${categoryColorClass(top.colorIndex)}`} style={{ width: `${width}%` }} />
          </div>
          <p className="mt-auto pt-2 text-xs text-ink-subtle">
            <span className="font-semibold text-ink tabular-nums">{formatCurrency(top.amount)}</span> · {formatPercent(top.sharePct)} of spend
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold text-ink-subtle">—</p>
          <p className="mt-auto pt-2 text-xs text-ink-subtle">No matching records are in the Expense Total.</p>
        </>
      )}
    </section>
  );
}
