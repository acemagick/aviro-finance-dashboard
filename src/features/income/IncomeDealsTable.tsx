import { Card } from '../../components/Card';
import { DownloadIcon } from '../../components/icons';
import type { DealStatus } from '../../types/finance';
import type { IncomeDealRow } from '../../types/income';
import { formatShortDate } from '../../utils/dateRange';
import { formatCurrency } from '../../utils/format';
import { getInitials } from '../../utils/income';

interface IncomeDealsTableProps {
  title: string;
  description: string;
  rows: IncomeDealRow[];
  total: number;
  /** Show the Responsible column (useful when "All people" is selected). */
  showResponsible: boolean;
  onExport: () => void;
}

const STAGE_TONES: Record<DealStatus, string> = {
  won: 'bg-positive/12 text-positive',
  inProgress: 'bg-caution/15 text-caution',
  lost: 'bg-negative/12 text-negative',
};

const headCell =
  'sticky top-0 z-10 border-y border-line bg-surface-muted px-3 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-ink-subtle uppercase';

export function IncomeDealsTable({ title, description, rows, total, showResponsible, onExport }: IncomeDealsTableProps) {
  return (
    <Card
      title={title}
      description={description}
      actions={
        <button
          type="button"
          onClick={onExport}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          title="Download these deals as a CSV file (opens in Excel)"
        >
          <DownloadIcon />
          Export
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle">No deals match these filters.</p>
      ) : (
        <div className="-mx-5 flex min-h-0 flex-1 flex-col">
          <div className="max-h-[30rem] overflow-auto">
            <table className="w-full min-w-[40rem] border-collapse text-[13px]">
              <thead>
                <tr className="text-left">
                  <th scope="col" className={`${headCell} pl-5`}>Deal</th>
                  {showResponsible && <th scope="col" className={headCell}>Responsible</th>}
                  <th scope="col" className={headCell}>Pipeline</th>
                  <th scope="col" className={headCell}>Stage</th>
                  <th scope="col" className={`${headCell} pr-5 text-right`} title="Total Project Cost, with installments received and pending">
                    Project Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {rows.map((row) => (
                  <tr key={row.dealId} className="align-middle hover:bg-surface-muted/60">
                    <td className="py-2.5 pr-3 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-income/12 text-xs font-bold text-income" aria-hidden="true">
                          {getInitials(row.title).slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{row.title}</p>
                          <p className="mt-0.5 text-xs text-ink-subtle">
                            #{row.dealId} · {formatShortDate(row.startDate)}
                            {row.departmentName && ` · ${row.departmentName}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    {showResponsible && <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{row.responsibleName}</td>}
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{row.pipelineName}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_TONES[row.status]}`}>
                        {row.stageName}
                      </span>
                    </td>
                    <td className="py-2.5 pr-5 pl-3 text-right whitespace-nowrap tabular-nums">
                      <p className="font-semibold text-ink">{row.amount === null ? '—' : formatCurrency(row.amount)}</p>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">
                        Received <span className="text-income">{formatCurrency(row.received)}</span>
                      </p>
                      <p
                        className={`text-[11px] ${row.receivedExceedsAmount ? 'text-caution' : 'text-ink-subtle'}`}
                        title={
                          row.pending === null
                            ? 'Total Project Cost is not filled in Bitrix24'
                            : row.receivedExceedsAmount
                              ? 'Installments received are more than the Total Project Cost'
                              : 'Total Project Cost − received'
                        }
                      >
                        Pending {row.pending === null ? '—' : formatCurrency(row.pending)}
                        {row.receivedExceedsAmount && ' · over'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mx-5 mt-3 flex items-center justify-between gap-4 rounded-xl bg-hero px-4 py-3 text-hero-ink">
            <p className="text-sm">
              <span className="font-semibold">Total</span>
              <span className="text-hero-muted"> · Σ Project Cost of {rows.length} deal{rows.length === 1 ? '' : 's'}</span>
            </p>
            <p className="text-lg font-bold text-hero-accent tabular-nums">{formatCurrency(total)}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
