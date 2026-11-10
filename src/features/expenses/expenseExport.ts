import type { ExpenseItemRow } from '../../types/expenses';
import type { DateRange } from '../../types/finance';
import { toCsv } from '../../utils/csv';
import { formatShortDate, toDateInputValue } from '../../utils/dateRange';
import { EXPENSE_SOURCE_LABELS } from '../../utils/expenseCategories';

/**
 * CSV of exactly the records shown in the table (amounts as plain rupee numbers for Excel).
 * Deal Amount is the linked deal's value, repeated per row; the total is the sum of the Expense
 * Amount of the rows in the Expense Total only ("In Expense Total" = Yes).
 */
export function buildExpenseItemsCsv(rows: readonly ExpenseItemRow[], total: number): string {
  const header = [
    'Date',
    'Expense',
    'Category',
    'Employee',
    'Department',
    'Site Name',
    'Deal / Project',
    'Deal ID',
    'Source (Bitrix24)',
    'Bitrix24 ID',
    'Date Basis',
    'In Expense Total',
    'Not in Expense Total: Reason',
    'Deal Amount (INR)',
    'Expense Amount (INR)',
  ];
  const body = rows.map((row) => [
    formatShortDate(row.date),
    row.title,
    row.categoryLabel,
    row.employeeName ?? '',
    row.departmentName ?? '',
    row.siteName ?? '',
    row.dealName ?? (row.dealLinkNote ? `General · ${row.dealLinkNote}` : 'General (not linked to a deal)'),
    row.dealId ?? '',
    EXPENSE_SOURCE_LABELS[row.source],
    row.sourceId,
    row.dateSource === 'created' ? 'Created on' : 'Record date',
    row.inExpenseTotal ? 'Yes' : 'No',
    row.notCountedReason ?? '',
    row.dealAmount === null ? '' : Math.round(row.dealAmount),
    row.amountMissing ? '' : Math.round(row.amount),
  ]);
  const counted = rows.filter((row) => row.inExpenseTotal).length;
  const footer = [
    '',
    `Expense Total of ${counted} item${counted === 1 ? '' : 's'}`,
    ...Array<string>(header.length - 3).fill(''),
    Math.round(total),
  ];
  return toCsv([header, ...body, footer]);
}

/** e.g. "aviro-expense-items_2026-09-01_to_2026-09-30.csv". */
export function expenseExportFilename(range: DateRange): string {
  return `aviro-expense-items_${toDateInputValue(range.start)}_to_${toDateInputValue(range.end)}.csv`;
}
