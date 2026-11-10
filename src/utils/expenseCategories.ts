import { EMPTY_CATEGORY_ID, type ExpenseCategoryTotal } from '../types/expenses';
import type { Expense, ExpenseCategoryOption, ExpenseSource, ExpenseTreatment } from '../types/finance';

/*
 * EXPENSE CATEGORIES — shared by the Expenses and Net Revenue dashboards so both
 * split expenses the same way.
 *
 * Categories are the options of the Bitrix24 "Essentials only" Category field (loaded
 * from Bitrix24). Only Categories counted as expenses can hold expenses; records of the
 * "Expenses" smart process have no Category and are shown as "No Category".
 */

export const NO_CATEGORY_LABEL = 'No Category';

/** "Essentials only" records whose Category field is empty in Bitrix24 (shown, never counted). */
export const EMPTY_CATEGORY_LABEL = 'Category not filled in';

/** How each type of Category is treated, in plain words. */
export const EXPENSE_TREATMENT_LABELS: Record<ExpenseTreatment, string> = {
  expense: 'In Expense Total',
  income: 'Not in Expense Total — income (money received)',
  request: 'Not in Expense Total — request, no payment',
  advance: 'Not in Expense Total — vendor advance, kept separate',
  purchase: 'Not in Expense Total — purchase, no accounting rule yet',
  unresolved: 'Not in Expense Total — no counting rule yet',
};

/** Names of the two Bitrix24 smart processes expenses come from. */
export const EXPENSE_SOURCE_LABELS: Record<ExpenseSource, string> = {
  expenses: 'Expenses',
  essentials: 'Essentials only',
};

/** Label and colour of an expense's Category. */
export function categoryDisplay(
  categoryId: string | null,
  optionsById: ReadonlyMap<string, ExpenseCategoryOption>,
): { label: string; colorIndex: number | null } {
  if (categoryId === null) return { label: NO_CATEGORY_LABEL, colorIndex: null };
  if (categoryId === EMPTY_CATEGORY_ID) return { label: EMPTY_CATEGORY_LABEL, colorIndex: null };
  const option = optionsById.get(categoryId);
  return { label: option?.label ?? `Category ${categoryId}`, colorIndex: option?.colorIndex ?? null };
}

/**
 * Totals per Category for the given expenses: every Category counted as an expense
 * (also when 0, so the list does not jump around), plus "No Category" when used.
 * Highest amount first. Shares are of `total`.
 */
export function totalsByCategory(
  expenses: readonly Expense[],
  options: readonly ExpenseCategoryOption[],
  total: number,
): ExpenseCategoryTotal[] {
  const totals = new Map<string | null, ExpenseCategoryTotal>();
  for (const option of options) {
    if (option.treatment !== 'expense') continue;
    totals.set(option.id, { categoryId: option.id, label: option.label, colorIndex: option.colorIndex, amount: 0, entryCount: 0, sharePct: null });
  }

  const optionsById = new Map(options.map((option) => [option.id, option]));
  for (const expense of expenses) {
    let entry = totals.get(expense.categoryId);
    if (!entry) {
      entry = { categoryId: expense.categoryId, ...categoryDisplay(expense.categoryId, optionsById), amount: 0, entryCount: 0, sharePct: null };
      totals.set(expense.categoryId, entry);
    }
    entry.amount += expense.amount;
    entry.entryCount += 1;
  }

  return [...totals.values()]
    .map((entry) => ({ ...entry, sharePct: total > 0 ? (entry.amount / total) * 100 : null }))
    .sort((a, b) => b.amount - a.amount);
}
