import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { MarginBadge } from '../../components/MarginBadge';
import type { DealNetRevenueRow, NetRevenueSummary } from '../../types/finance';
import { formatCurrency, formatSignedCurrency } from '../../utils/format';

interface DealNetRevenueTableProps {
  rows: DealNetRevenueRow[];
  summary: NetRevenueSummary;
}

type SortKey = 'title' | 'responsibleName' | 'income' | 'expenses' | 'netRevenue' | 'marginPct';
type SortDirection = 'asc' | 'desc';

interface Column {
  label: string;
  sortKey: SortKey | null;
  numeric: boolean;
}

const COLUMNS: readonly Column[] = [
  { label: 'Deal', sortKey: 'title', numeric: false },
  { label: 'Responsible', sortKey: 'responsibleName', numeric: false },
  { label: 'Project / Site', sortKey: null, numeric: false },
  { label: 'Income', sortKey: 'income', numeric: true },
  { label: 'Expenses', sortKey: 'expenses', numeric: true },
  { label: 'Profit / Loss', sortKey: 'netRevenue', numeric: true },
  { label: 'Margin', sortKey: 'marginPct', numeric: true },
];

/** Sorts rows; empty values (e.g. no margin) always go to the bottom. */
function sortRows(rows: readonly DealNetRevenueRow[], key: SortKey, direction: SortDirection) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    if (typeof left === 'string' && typeof right === 'string') return left.localeCompare(right) * factor;
    return ((left as number) - (right as number)) * factor;
  });
}

function projectDetails(row: DealNetRevenueRow): string | null {
  const parts = [row.projectType, row.plantCapacityKw === null ? null : `${row.plantCapacityKw} kW`];
  const text = parts.filter((part) => part !== null).join(' · ');
  return text || null;
}

function profitClass(value: number): string {
  return value < 0 ? 'text-negative' : 'text-positive';
}

const cell = 'px-3 py-3';

export function DealNetRevenueTable({ rows, summary }: DealNetRevenueTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('netRevenue');
  const [direction, setDirection] = useState<SortDirection>('desc');

  const sortedRows = useMemo(() => sortRows(rows, sortKey, direction), [rows, sortKey, direction]);
  const visibleRows = sortedRows.slice(0, 50);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection(key === 'title' || key === 'responsibleName' ? 'asc' : 'desc');
    }
  };

  return (
    <Card
      title="Deal-wise P&L"
      description={`Income − expenses = profit / loss, per deal · ${rows.length} deal${rows.length === 1 ? '' : 's'} · showing first 50`}
    >
      {rows.length === 0 && summary.generalExpenses === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle">
          No deals match these filters.
        </p>
      ) : (
        <div className="-mx-5 -mb-5 max-h-[34rem] overflow-auto rounded-b-2xl">
          <table className="w-full min-w-[50rem] border-collapse text-[13px]">
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const active = column.sortKey !== null && column.sortKey === sortKey;
                  const key = column.sortKey;
                  return (
                    <th
                      key={column.label}
                      scope="col"
                      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={`sticky top-0 z-10 border-y border-line bg-surface-muted px-3 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-ink-subtle uppercase first:pl-5 last:pr-5 ${column.numeric ? 'text-right' : 'text-left'}`}
                    >
                      {key === null ? (
                        column.label
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSort(key)}
                          className={`inline-flex min-h-6 items-center gap-1 uppercase hover:text-ink max-sm:min-h-11 focus-visible:underline focus-visible:outline-none ${active ? 'text-ink' : ''}`}
                        >
                          {column.label}
                          <span aria-hidden="true" className="w-2">{active ? (direction === 'asc' ? '▲' : '▼') : ''}</span>
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {visibleRows.map((row) => {
                const details = projectDetails(row);
                return (
                  <tr key={row.dealId} className="align-top hover:bg-surface-muted/60">
                    <td className={`${cell} pl-5`}>
                      <p className="font-semibold text-ink">{row.title}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        #{row.dealId} · {row.stageName}
                      </p>
                    </td>
                    <td className={`${cell} whitespace-nowrap text-ink-muted`}>{row.responsibleName}</td>
                    <td className={cell}>
                      <p className="text-ink-muted">{row.siteName ?? '—'}</p>
                      {details && <p className="mt-0.5 text-xs text-ink-subtle">{details}</p>}
                    </td>
                    <td className={`${cell} text-right whitespace-nowrap text-income tabular-nums`}>{formatCurrency(row.income)}</td>
                    <td className={`${cell} text-right whitespace-nowrap text-expense tabular-nums`}>{formatCurrency(row.expenses)}</td>
                    <td className={`${cell} text-right font-semibold whitespace-nowrap tabular-nums ${profitClass(row.netRevenue)}`}>
                      {formatSignedCurrency(row.netRevenue)}
                    </td>
                    <td className={`${cell} pr-5 text-right`}>
                      <MarginBadge value={row.marginPct} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {summary.generalExpenses > 0 && (
                <tr className="border-t border-line text-ink-muted">
                  <td className={`${cell} pl-5 italic`} colSpan={3}>General costs (not linked to a deal)</td>
                  <td className={`${cell} text-right`}>—</td>
                  <td className={`${cell} text-right whitespace-nowrap text-expense tabular-nums`}>{formatCurrency(summary.generalExpenses)}</td>
                  <td className={`${cell} text-right font-semibold whitespace-nowrap text-negative tabular-nums`}>
                    {formatSignedCurrency(-summary.generalExpenses)}
                  </td>
                  <td className={`${cell} pr-5 text-right text-ink-subtle`}>—</td>
                </tr>
              )}
              <tr className="border-t-2 border-line bg-surface-muted font-semibold text-ink">
                <td className={`${cell} pl-5`} colSpan={3}>Total</td>
                <td className={`${cell} text-right whitespace-nowrap tabular-nums`}>{formatCurrency(summary.income)}</td>
                <td className={`${cell} text-right whitespace-nowrap tabular-nums`}>{formatCurrency(summary.expenses)}</td>
                <td className={`${cell} text-right whitespace-nowrap tabular-nums ${profitClass(summary.netRevenue)}`}>
                  {formatSignedCurrency(summary.netRevenue)}
                </td>
                <td className={`${cell} pr-5 text-right`}>
                  <MarginBadge value={summary.marginPct} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
