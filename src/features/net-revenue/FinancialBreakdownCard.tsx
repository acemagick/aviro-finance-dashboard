import { Card } from '../../components/Card';
import { IncomeExpenseBar } from '../../components/IncomeExpenseBar';
import { LegendItem } from '../../components/LegendItem';
import type { BreakdownRow } from '../../types/finance';
import { formatCurrency, formatCurrencyCompact, formatSignedCurrencyCompact } from '../../utils/format';

interface FinancialBreakdownCardProps {
  title: string;
  description: string;
  rows: BreakdownRow[];
  emptyText: string;
}

/**
 * Income, expenses and net revenue per group (department, pipeline, ...).
 * Reusable for any grouping that produces BreakdownRow items.
 */
export function FinancialBreakdownCard({ title, description, rows, emptyText }: FinancialBreakdownCardProps) {
  const scale = Math.max(0, ...rows.map((row) => Math.max(row.income, row.expenses)));

  return (
    <Card
      title={title}
      description={description}
      actions={
        <div className="flex items-center gap-3">
          <LegendItem colorClass="bg-income" label="Income" />
          <LegendItem colorClass="bg-expense" label="Expenses" />
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle">{emptyText}</p>
      ) : (
        <>
          <ul className="space-y-4">
            {rows.map((row) => (
              <li key={row.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className={`min-w-0 text-sm font-medium ${row.isGeneral ? 'text-ink-muted italic' : 'text-ink'}`}>
                    {row.label}
                    {row.dealCount > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-ink-subtle">
                        {row.dealCount} deal{row.dealCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </p>
                  <dl className="flex items-baseline gap-3 text-xs tabular-nums">
                    <div className="flex gap-1">
                      <dt className="sr-only">Income</dt>
                      <dd className="text-income" title={`Income ${formatCurrency(row.income)}`}>
                        {formatCurrencyCompact(row.income)}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="sr-only">Expenses</dt>
                      <dd className="text-expense" title={`Expenses ${formatCurrency(row.expenses)}`}>
                        {formatCurrencyCompact(row.expenses)}
                      </dd>
                    </div>
                    <div className="flex min-w-16 justify-end gap-1">
                      <dt className="sr-only">Net revenue</dt>
                      <dd
                        className={`text-sm font-bold ${row.netRevenue < 0 ? 'text-negative' : 'text-ink'}`}
                        title={`Net revenue ${formatCurrency(row.netRevenue)}`}
                      >
                        {formatSignedCurrencyCompact(row.netRevenue)}
                      </dd>
                    </div>
                  </dl>
                </div>
                <IncomeExpenseBar income={row.income} expenses={row.expenses} scale={scale} className="mt-2" />
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-4 text-[11px] text-ink-subtle">
            Bar: red = spent on expenses, green = kept as net revenue. Last figure in each row is net revenue.
          </p>
        </>
      )}
    </Card>
  );
}
