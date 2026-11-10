import { format } from 'date-fns';
import { Card } from '../../components/Card';
import { DownloadIcon } from '../../components/icons';
import { PersonAvatar } from '../../components/PersonAvatar';
import type { ExpenseItemRow } from '../../types/expenses';
import { EXPENSE_SOURCE_LABELS } from '../../utils/expenseCategories';
import { formatCurrency } from '../../utils/format';
import { categoryColorClass } from './categoryStyles';

interface ExpenseItemsTableProps {
  description: string;
  rows: ExpenseItemRow[];
  /** Sum of the rows that are in the Expense Total. */
  total: number;
  /** Rows shown but not in the Expense Total (not part of `total`). */
  notInTotal: { count: number; amount: number };
  /** Hide the project sub-line when a single deal is selected (it would repeat on every row). */
  showDeal: boolean;
  onExport: () => void;
}

const headCellBase =
  'sticky top-0 z-10 border-y border-line bg-surface-muted px-2 py-2.5 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase';
const headCell = `${headCellBase} whitespace-nowrap`;
/** Below md the table scrolls sideways; the Expense amount column stays visible at the right edge. */
const PINNED_AMOUNT = 'max-md:sticky max-md:right-0 max-md:shadow-[-1px_0_0_var(--line)]';

/** Every record matching the filters, newest first; records not in the Expense Total are marked. */
export function ExpenseItemsTable({ description, rows, total, notInTotal, showDeal, onExport }: ExpenseItemsTableProps) {
  const countedRows = rows.length - notInTotal.count;
  return (
    <Card
      title="Expense items"
      description={description}
      actions={
        <button
          type="button"
          onClick={onExport}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          title="Download these expense items as a CSV file (opens in Excel)"
        >
          <DownloadIcon />
          Export
        </button>
      }
    >
      {rows.length === 0 ? (
        <p className="grid flex-1 place-items-center py-16 text-center text-sm text-ink-subtle">No records match these filters.</p>
      ) : (
        <div className="-mx-5 flex min-h-0 flex-1 flex-col">
          <div className="max-h-[36rem] overflow-auto">
            <table className="w-full min-w-[34rem] border-collapse text-[13px]">
              <thead>
                <tr className="text-left">
                  <th scope="col" className={`${headCell} pl-5`}>Date</th>
                  <th scope="col" className={`${headCell} min-w-[6.5rem]`}>Expense</th>
                  <th scope="col" className={headCell}>Category</th>
                  <th scope="col" className={headCell}>Employee</th>
                  <th scope="col" className={headCell}>Site name</th>
                  <th scope="col" className={`${headCellBase} text-right`}>Deal amount</th>
                  <th scope="col" className={`${headCellBase} ${PINNED_AMOUNT} z-20 pr-5 text-right`}>Expense amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {rows.map((row) => (
                  <tr key={row.id} className="align-middle hover:bg-surface-muted/60">
                    <td className="py-2.5 pr-2 pl-5 whitespace-nowrap text-ink-muted tabular-nums">
                      {format(row.date, 'dd MMM yyyy')}
                      {row.dateSource === 'created' && <p className="mt-0.5 text-[11px] text-ink-subtle">Created on</p>}
                    </td>
                    <td className="px-2 py-2.5 [overflow-wrap:anywhere]">
                      <p className="font-semibold text-ink">{row.title}</p>
                      {!row.inExpenseTotal && (
                        <p className="mt-1 w-fit rounded-md bg-caution/15 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                          Not in Expense Total{row.notCountedReason ? ` · ${row.notCountedReason}` : ''}
                        </p>
                      )}
                      {showDeal && (
                        <p className="mt-0.5 text-xs text-ink-subtle">
                          {row.dealName ? `${row.dealName} · #${row.dealId}` : row.dealLinkNote ? `General · ${row.dealLinkNote}` : 'General (not linked to a deal)'}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-ink-subtle">
                        {EXPENSE_SOURCE_LABELS[row.source]} #{row.sourceId}
                        {row.note && ` · ${row.note}`}
                      </p>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink">
                        <span className={`size-1.5 shrink-0 rounded-full ${categoryColorClass(row.colorIndex)}`} aria-hidden="true" />
                        {row.categoryLabel}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        {row.employeeId !== null && row.employeeName !== null && (
                          // Hidden below 1536px so all columns, including Amount, fit next to the category chart.
                          <span className="hidden shrink-0 2xl:inline-flex">
                            <PersonAvatar id={row.employeeId} name={row.employeeName} size="sm" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className={row.employeeName === null ? 'text-ink-subtle' : 'text-ink-muted'}>
                            {row.employeeName ?? '—'}
                          </p>
                          {row.departmentName && <p className="mt-0.5 text-xs text-ink-subtle">{row.departmentName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-ink-muted [overflow-wrap:anywhere]">{row.siteName ?? '—'}</td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap text-ink-muted tabular-nums">
                      {row.dealAmount === null ? '—' : formatCurrency(row.dealAmount)}
                    </td>
                    <td
                      className={`${PINNED_AMOUNT} bg-surface py-2.5 pr-5 pl-2 text-right whitespace-nowrap tabular-nums md:bg-transparent ${row.inExpenseTotal ? 'font-semibold text-ink' : 'text-ink-subtle'}`}
                    >
                      {row.amountMissing ? '—' : formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mx-5 mt-3 flex items-center justify-between gap-4 rounded-xl bg-hero px-4 py-3 text-hero-ink">
            <div className="text-sm">
              <p>
                <span className="font-semibold">Total</span>
                <span className="text-hero-muted">
                  {' '}
                  · Σ Expense amount of {countedRows} item{countedRows === 1 ? '' : 's'} in the Expense Total
                </span>
              </p>
              {notInTotal.count > 0 && (
                <p className="mt-0.5 text-xs text-hero-muted">
                  + {notInTotal.count} shown record{notInTotal.count === 1 ? '' : 's'} not in Expense Total ({formatCurrency(notInTotal.amount)}, not added)
                </p>
              )}
            </div>
            <p className="text-lg font-bold text-expense tabular-nums">{formatCurrency(total)}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
