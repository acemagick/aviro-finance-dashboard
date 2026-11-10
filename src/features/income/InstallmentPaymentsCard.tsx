import { Card } from '../../components/Card';
import type { InstallmentSummary } from '../../types/income';
import type { DateRange } from '../../types/finance';
import { formatDateRange, formatShortDate } from '../../utils/dateRange';
import { formatCurrency } from '../../utils/format';

interface InstallmentPaymentsCardProps {
  summary: InstallmentSummary;
  /** The applied Payment Period of the Installment Payments tab. */
  dateRange: DateRange;
  /** Show the Responsible column (useful when "All people" is selected). */
  showResponsible: boolean;
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th". */
function ordinal(value: number): string {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th';
  return `${value}${suffix}`;
}

const headCell =
  'sticky top-0 z-10 border-y border-line bg-surface-muted px-3 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-ink-subtle uppercase';

function Figure({ label, value, note, className = 'text-ink' }: { label: string; value: string; note: string; className?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line-subtle bg-surface-muted/60 px-4 py-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={`mt-1 truncate text-xl font-bold tracking-tight tabular-nums ${className}`} title={value}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-subtle">{note}</p>
    </div>
  );
}

/**
 * Installment payments from the Bitrix24 deal installment fields, for the Installment Payments
 * tab's applied Payment Period (matched on each installment's Payment Received Date).
 */
export function InstallmentPaymentsCard({ summary, dateRange, showResponsible }: InstallmentPaymentsCardProps) {
  const { payments } = summary;

  return (
    <Card title="Installment Payments" description="Matched on each installment’s Payment Received Date">
      <p className="text-sm text-ink-muted">
        Showing payments received: <span className="font-semibold whitespace-nowrap text-ink">{formatDateRange(dateRange)}</span>
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="Received in period"
          value={formatCurrency(summary.receivedInPeriod)}
          note={`${payments.length} payment${payments.length === 1 ? '' : 's'} · ${summary.payingDealCount} deal${summary.payingDealCount === 1 ? '' : 's'}`}
          className="text-income"
        />
        <Figure
          label="Received to date"
          value={formatCurrency(summary.receivedToDate)}
          note={`Up to ${formatShortDate(dateRange.end)} · ${summary.installmentDealCount} installment deal${summary.installmentDealCount === 1 ? '' : 's'}`}
        />
        <Figure
          label="Pending"
          value={formatCurrency(summary.pending)}
          note="Deal Amount − received to date"
          className="text-caution"
        />
        <Figure
          label="Recorded, no received date"
          value={formatCurrency(summary.undatedAmount)}
          note={`${summary.undatedCount} installment${summary.undatedCount === 1 ? '' : 's'} · not counted as received`}
        />
      </div>

      {summary.receivedExceedsAmountCount > 0 && (
        <p className="mt-3 text-xs text-caution">
          {summary.receivedExceedsAmountCount} installment deal{summary.receivedExceedsAmountCount === 1 ? ' has' : 's have'} received more
          than the Deal Amount — pending is shown as ₹0. Check the Deal Amount in Bitrix24.
        </p>
      )}

      {payments.length === 0 ? (
        <p className="grid place-items-center py-10 text-center text-sm text-ink-subtle">
          No installment payments were received in this period.
        </p>
      ) : (
        <div className="-mx-5 mt-4 flex min-h-0 flex-col">
          <div className="max-h-[24rem] overflow-auto">
            <table className="w-full min-w-[36rem] border-collapse text-[13px]">
              <thead>
                <tr className="text-left">
                  <th scope="col" className={`${headCell} pl-5`}>Received on</th>
                  <th scope="col" className={headCell}>Deal</th>
                  <th scope="col" className={headCell}>Installment</th>
                  {showResponsible && <th scope="col" className={headCell}>Responsible</th>}
                  <th scope="col" className={`${headCell} pr-5 text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {payments.map((row) => (
                  <tr key={row.id} className="align-middle hover:bg-surface-muted/60">
                    <td className="py-2.5 pr-3 pl-5 whitespace-nowrap text-ink">{formatShortDate(row.receivedDate)}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-ink">{row.dealTitle}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">#{row.dealId}</p>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{ordinal(row.installmentNumber)} Installment</td>
                    {showResponsible && <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{row.responsibleName}</td>}
                    <td className="py-2.5 pr-5 pl-3 text-right font-semibold whitespace-nowrap text-ink tabular-nums">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mx-5 mt-3 flex items-center justify-between gap-4 rounded-xl bg-hero px-4 py-3 text-hero-ink">
            <p className="text-sm">
              <span className="font-semibold">Total received</span>
              <span className="text-hero-muted">
                {' '}
                · Σ {payments.length} payment{payments.length === 1 ? '' : 's'} in this period
              </span>
            </p>
            <p className="text-lg font-bold text-hero-accent tabular-nums">{formatCurrency(summary.receivedInPeriod)}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
