import type { ExpenseTrendPoint } from '../../types/expenses';
import { formatDateRange, GRANULARITY_LABELS } from '../../utils/dateRange';
import { formatCurrency } from '../../utils/format';
import type { DateRange, TrendGranularity } from '../../types/finance';

interface ExpenseEntriesCardProps {
  /** Every matching record (the Expense items rows). */
  recordCount: number;
  /** Matching records in the Expense Total. */
  inTotalCount: number;
  /** Matching records not in the Expense Total. */
  notInTotal: { count: number; amount: number };
  trend: ExpenseTrendPoint[];
  granularity: TrendGranularity;
  dateRange: DateRange;
}

const count = (value: number) => value.toLocaleString('en-IN');

/**
 * Number of matching expense records (also those not in the Expense Total), split into in / not in
 * the Expense Total, with small bars showing when they were booked.
 */
export function ExpenseEntriesCard({ recordCount, inTotalCount, notInTotal, trend, granularity, dateRange }: ExpenseEntriesCardProps) {
  const max = Math.max(0, ...trend.map((point) => point.recordCount));
  const showBars = trend.length > 1 && max > 0;

  return (
    <section aria-label="Expense entries" className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm font-medium text-ink-muted">Expense entries</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-ink tabular-nums">{count(recordCount)}</p>
      <p className="text-xs text-ink-subtle">matching record{recordCount === 1 ? '' : 's'}</p>
      <dl className="mt-2 space-y-0.5 text-xs text-ink-muted">
        <div className="flex justify-between gap-2">
          <dt>In Expense Total</dt>
          <dd className="font-semibold text-ink tabular-nums">{count(inTotalCount)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="whitespace-nowrap">Not in Expense Total</dt>
          <dd className="text-right tabular-nums">
            <span className="font-semibold text-ink">{count(notInTotal.count)}</span>
            {notInTotal.count > 0 && <> · {formatCurrency(notInTotal.amount)} excluded</>}
          </dd>
        </div>
      </dl>
      {showBars ? (
        <div
          className="mt-3 flex h-12 items-end gap-1"
          role="img"
          aria-label={`Number of matching expense records in the selected period, ${GRANULARITY_LABELS[granularity]}`}
        >
          {trend.map((point) => (
            <div
              key={point.key}
              className="min-w-0 flex-1 rounded-t bg-expense/70"
              style={{ height: `${Math.max((point.recordCount / max) * 100, point.recordCount > 0 ? 8 : 3)}%` }}
              title={`${point.label}: ${point.recordCount} record${point.recordCount === 1 ? '' : 's'} (${point.entryCount} in Expense Total)`}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 h-12" aria-hidden="true" />
      )}
      <p className="mt-auto pt-2 text-xs text-ink-subtle">{formatDateRange(dateRange)}</p>
    </section>
  );
}
