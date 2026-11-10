interface IncomeExpenseBarProps {
  income: number;
  expenses: number;
  /** Largest value across all rows, so bars are comparable. */
  scale: number;
  className?: string;
}

/**
 * Thin bar showing how income was used:
 * red part = spent on expenses, green part = kept as net revenue.
 * Bar length is relative to the largest row.
 */
export function IncomeExpenseBar({ income, expenses, scale, className = '' }: IncomeExpenseBarProps) {
  const base = Math.max(income, expenses, 0);
  const length = scale > 0 ? (base / scale) * 100 : 0;
  const expenseShare = base > 0 ? (Math.max(expenses, 0) / base) * 100 : 0;

  return (
    <div className={`h-1.5 w-full rounded-full bg-line-subtle ${className}`} aria-hidden="true">
      {length > 0 && (
        <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${Math.max(length, 2)}%` }}>
          <div className="h-full bg-expense" style={{ width: `${expenseShare}%` }} />
          <div className="h-full flex-1 bg-income" />
        </div>
      )}
    </div>
  );
}
