import { Card } from '../../components/Card';
import type { CategoryExpense } from '../../types/finance';
import { formatCurrency, formatPercent } from '../../utils/format';
// Same Category colours as the Expenses dashboard.
import { categoryColorClass } from '../expenses/categoryStyles';

interface ExpensesByCategoryCardProps {
  categories: CategoryExpense[];
  totalExpenses: number;
}

/** Expenses split by Category (Bitrix24 "Essentials only" Category field, same split as the Expenses dashboard). */
export function ExpensesByCategoryCard({ categories, totalExpenses }: ExpensesByCategoryCardProps) {
  const hasExpenses = totalExpenses > 0;

  return (
    <Card
      title="Expenses by category"
      description={`Total ${formatCurrency(totalExpenses)}`}
    >
      {!hasExpenses ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle">
          No expenses in Bitrix24 for the selected period.
        </p>
      ) : (
        <>
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Share of total expenses by category">
            {categories
              .filter((item) => item.amount > 0)
              .map((item) => (
                <div
                  key={item.categoryId ?? 'none'}
                  className={`h-full first:rounded-l-full last:rounded-r-full ${categoryColorClass(item.colorIndex)}`}
                  style={{ width: `${item.sharePct ?? 0}%` }}
                  title={`${item.label}: ${formatPercent(item.sharePct)}`}
                />
              ))}
          </div>

          <ul className="mt-5 divide-y divide-line-subtle">
            {categories.map((item) => (
              <li key={item.categoryId ?? 'none'} className="flex items-center gap-3 py-2.5 text-sm">
                <span className={`size-2.5 shrink-0 rounded-sm ${categoryColorClass(item.colorIndex)}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 text-ink">{item.label}</span>
                <span className="font-semibold text-ink tabular-nums">{formatCurrency(item.amount)}</span>
                <span className="w-12 text-right text-xs text-ink-subtle tabular-nums">{formatPercent(item.sharePct)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
