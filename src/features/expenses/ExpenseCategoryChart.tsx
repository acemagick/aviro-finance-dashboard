import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '../../components/Card';
import { InfoIcon } from '../../components/icons';
import { categoryChartColor, useChartPalette } from '../../theme/chartPalette';
import type { ExpenseCategoryTotal, ExpenseNotInTotalCategory } from '../../types/expenses';
import { EXPENSE_TREATMENT_LABELS } from '../../utils/expenseCategories';
import { formatCurrency, formatCurrencyCompact, formatPercent } from '../../utils/format';
import { categoryColorClass } from './categoryStyles';

interface ExpenseCategoryChartProps {
  categories: ExpenseCategoryTotal[];
  total: number;
  categoriesUsed: number;
  /** Matching records not in the Expense Total, per Category (listed, never added to the chart). */
  notInTotal: ExpenseNotInTotalCategory[];
}

const HOW_CALCULATED =
  'This chart sums the Expenses Bill Amount of records included in Expense Total and groups them by their Bitrix24 Category. ' +
  'Every Category counts the same way; no other amount field (Deal Amount, Total Amount, Total Invoice Amount, instalments) is used.';

/**
 * "How is this calculated?": hover shows it as a tooltip; click / tap / keyboard opens it below
 * the card's title block (Card `titleAddon`), so it always stays inside the card.
 */
function HowCalculatedInfo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        aria-expanded={open}
        aria-label="How is this calculated?"
        title={`How is this calculated?\n${HOW_CALCULATED}`}
        className="grid size-6 shrink-0 place-items-center rounded-full text-ink-subtle hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none"
      >
        <InfoIcon />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute top-full left-0 z-20 mt-2 block w-full max-w-80 rounded-xl border border-line bg-surface p-3 text-xs font-normal text-ink-muted shadow-lg"
        >
          <span className="block font-semibold text-ink">How is this calculated?</span>
          <span className="mt-1 block">{HOW_CALCULATED}</span>
        </span>
      )}
    </>
  );
}

/** How a Category's records that are not in the Expense Total are treated, e.g. "Not in Expense Total — purchase, …". */
function notInTotalTreatment(item: ExpenseNotInTotalCategory): string {
  if (item.treatment !== null && item.treatment !== 'expense') return EXPENSE_TREATMENT_LABELS[item.treatment];
  return `Not in Expense Total — ${item.reasons.join(', ').toLowerCase()}`;
}

/** Matching records that are not in the Expense Total: shown by Category, never in the chart. */
function NotInTotalList({ items }: { items: ExpenseNotInTotalCategory[] }) {
  return (
    <div className="mt-5 border-t border-line-subtle pt-4">
      <p className="text-xs font-semibold tracking-wider text-ink-subtle uppercase">Matching records not in Expense Total</p>
      <ul className="mt-2 space-y-2.5">
        {items.map((item) => (
          <li key={item.categoryId ?? 'none'} className="text-sm">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 shrink-0 rounded-sm opacity-50 ${categoryColorClass(item.colorIndex)}`} aria-hidden="true" />
              <span className="line-clamp-2 min-w-0 flex-1 text-ink">{item.label}</span>
              <span className="text-xs text-ink-subtle tabular-nums">
                {item.count.toLocaleString('en-IN')} record{item.count === 1 ? '' : 's'}
              </span>
              <span className="font-semibold text-ink-muted tabular-nums">{formatCurrency(item.amount)}</span>
            </div>
            <p className="mt-0.5 pl-4.5 text-xs text-ink-subtle">{notInTotalTreatment(item)} · In Expense Total: {formatCurrency(0)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Donut of spend per Category (Bitrix24 "Essentials only" Category field) + list of the counted Categories. */
export function ExpenseCategoryChart({ categories, total, categoriesUsed, notInTotal }: ExpenseCategoryChartProps) {
  const palette = useChartPalette();
  const slices = categories.filter((item) => item.amount > 0);
  const notInTotalCount = notInTotal.reduce((sum, item) => sum + item.count, 0);
  const notInTotalAmount = notInTotal.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Card
      title="Expense Total by Category"
      description="Expense Amount of records counted in Expense Total, grouped by Bitrix24 Category"
      titleAddon={<HowCalculatedInfo />}
    >
      {total <= 0 ? (
        notInTotalCount > 0 ? (
          <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle">
            {notInTotalCount === 1
              ? `1 record matches these filters (${formatCurrency(notInTotalAmount)}), but it is not included in the Expense Total.`
              : `${notInTotalCount.toLocaleString('en-IN')} records match these filters (${formatCurrency(notInTotalAmount)}), but none of them are included in the Expense Total.`}
          </p>
        ) : (
          <p className="grid flex-1 place-items-center py-16 text-center text-sm text-ink-subtle">No expenses match these filters.</p>
        )
      ) : (
        <>
          <div className="relative mx-auto h-56 w-full max-w-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="95%"
                  paddingAngle={slices.length > 1 ? 1.5 : 0}
                  stroke={palette.surface}
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {slices.map((item) => (
                    <Cell key={item.categoryId ?? 'none'} fill={categoryChartColor(palette, item.colorIndex)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    color: 'var(--ink)',
                    fontSize: 12,
                  }}
                  itemStyle={{ color: 'var(--ink)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
              <span className="text-2xl font-bold tracking-tight text-ink tabular-nums">{formatCurrencyCompact(total)}</span>
              <span className="text-xs text-ink-subtle">
                {categoriesUsed} categor{categoriesUsed === 1 ? 'y' : 'ies'}
              </span>
            </div>
          </div>
          <p className="sr-only">
            Total {formatCurrency(total)} across {categoriesUsed} categories.
          </p>

          <ul className="mt-5 space-y-3">
            {categories.map((item) => (
              <li key={item.categoryId ?? 'none'}>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`size-2.5 shrink-0 rounded-sm ${categoryColorClass(item.colorIndex)}`} aria-hidden="true" />
                  <span className={`line-clamp-2 min-w-0 flex-1 ${item.amount > 0 ? 'text-ink' : 'text-ink-subtle'}`}>{item.label}</span>
                  <span className="font-semibold text-ink tabular-nums">{formatCurrency(item.amount)}</span>
                  <span className="w-12 text-right text-xs text-ink-subtle tabular-nums">{formatPercent(item.sharePct)}</span>
                </div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-line-subtle" aria-hidden="true">
                  {item.amount > 0 && (
                    <div
                      className={`h-full rounded-full ${categoryColorClass(item.colorIndex)}`}
                      style={{ width: `${Math.max(item.sharePct ?? 0, 1)}%` }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {notInTotal.length > 0 && <NotInTotalList items={notInTotal} />}
    </Card>
  );
}
