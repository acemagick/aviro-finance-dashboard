/**
 * Pages of the AVIRO Finance Module.
 * To add a module later, add it here with `available: true`
 * and render its dashboard in App.tsx.
 */

export type FinanceView = 'net-revenue' | 'income' | 'expenses';

export interface FinanceViewItem {
  id: FinanceView;
  label: string;
  available: boolean;
  /** Short note for unavailable items, e.g. "Step 3". */
  note?: string;
}

export const FINANCE_VIEWS: readonly FinanceViewItem[] = [
  { id: 'net-revenue', label: 'Net Revenue', available: true },
  { id: 'income', label: 'Income', available: true },
  { id: 'expenses', label: 'Expenses', available: true },
];

/** The page shown when the address has no (valid) page in it. */
export const DEFAULT_FINANCE_VIEW: FinanceView = 'income';

export function isAvailableView(value: string): value is FinanceView {
  return FINANCE_VIEWS.some((view) => view.id === value && view.available);
}
