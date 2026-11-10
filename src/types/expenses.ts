import type { DealStatus, EssentialsCategorySummary, ExpenseSource, ExpenseTreatment, PeriodSelection, TrendGranularity } from './finance';

/**
 * Types for the Expenses Dashboard.
 * Expenses come from the Bitrix24 "Expenses" and "Essentials only" smart processes,
 * each optionally linked to a deal. The Expense record itself is the shared
 * `Expense` type in finance.ts.
 */

export type ExpenseAmountRangeId = 'any' | 'under-10k' | '10k-50k' | '50k-2l' | '2l-10l' | 'over-10l';

/** Value of the Project / Deal filter for expenses not linked to any deal. */
export const GENERAL_EXPENSES_DEAL_ID = '__general__';

/** Value of the Category filter for expenses without a Category (records of the "Expenses" smart process). */
export const NO_CATEGORY_ID = '__no-category__';

/** Category value of "Essentials only" records whose Category field is empty in Bitrix24. */
export const EMPTY_CATEGORY_ID = '__category-empty__';

/** Prefix of Employee / Department filter values that are typed values, not Bitrix24 IDs. */
export const TYPED_VALUE_PREFIX = 'typed:';

export interface ExpenseFilters extends PeriodSelection {
  /** A deal ID, GENERAL_EXPENSES_DEAL_ID, or null for all projects. */
  dealId: string | null;
  /** A Category option ID, NO_CATEGORY_ID, or null for all categories. */
  category: string | null;
  amountRange: ExpenseAmountRangeId;
  /** The record-level Responsible person's Bitrix24 user ID, or null for all employees. */
  employeeId: string | null;
  /** A Bitrix24 department ID, a typed-value key (`typed:…`), or null for all departments. */
  departmentId: string | null;
  siteName: string | null;
}

export interface ExpenseItemRow {
  id: string;
  date: Date;
  title: string;
  source: ExpenseSource;
  /** Bitrix24 item ID within its source. */
  sourceId: string;
  categoryId: string | null;
  categoryLabel: string;
  /** Position in the category colour series; null = "No Category". */
  colorIndex: number | null;
  /** Record-level Responsible person (Bitrix24 user ID), as used by the Employee filter. */
  employeeId: string | null;
  /** The Responsible person's name. `null` (shown "—") when the record has none. */
  employeeName: string | null;
  /** Department name, or the typed value exactly as in Bitrix24. `null` when the field is empty. */
  departmentName: string | null;
  siteName: string | null;
  dealId: string | null;
  dealName: string | null;
  /**
   * What the Deal / Project field holds when it is not an existing deal: "Linked to a lead (not a
   * deal)", "Deal #13358 (no longer in Bitrix24)", or null (General). Such records are General.
   */
  dealLinkNote: string | null;
  /**
   * The linked deal's Deal Amount (Bitrix24 OPPORTUNITY, the deal value), repeated on every
   * expense row of that deal and never added up. `null` when the expense has no (existing) deal.
   */
  dealAmount: number | null;
  /** The expense record's own amount. */
  amount: number;
  /** No amount on the record (shown as "—"). */
  amountMissing: boolean;
  /** False for records shown but not counted in the Expense Total. */
  inExpenseTotal: boolean;
  notCountedReason: string | null;
  /** 'created' when the Created on day is shown because the record has no business date. */
  dateSource: 'business' | 'created';
  note: string | null;
}

export interface ExpenseCategoryTotal {
  /** Category option ID, or null for expenses without a Category. */
  categoryId: string | null;
  label: string;
  /** Position in the category colour series; null = "No Category". */
  colorIndex: number | null;
  amount: number;
  entryCount: number;
  /** Share of total filtered expenses. `null` when the total is 0. */
  sharePct: number | null;
}

/** Summary of one selected deal: income = installments received, expenses = all linked expenses. */
export interface ExpenseDealSummary {
  dealId: string;
  title: string;
  siteName: string | null;
  responsibleName: string;
  pipelineName: string;
  stageName: string;
  status: DealStatus;
  /** Income = the deal's installments received (with a received date). Not the Deal Amount. */
  income: number;
  /** Installments 1–7 with an amount filled in on the deal (0 = none recorded in Bitrix24). */
  instalmentCount: number;
  /** Installments with an amount but no received date: not received, so not in `income`. */
  undatedInstalments: { count: number; amount: number };
  /** All expenses linked to the deal (any date, any category) — same as Step 1's deal-wise P&L. */
  linkedExpenses: number;
  linkedEntryCount: number;
  /** income − linkedExpenses. */
  netAmount: number;
  /** linkedExpenses ÷ income × 100. `null` when the income is 0. */
  spentPct: number | null;
  /** netAmount ÷ income × 100. `null` when the income is 0. */
  marginPct: number | null;
}

export interface ExpenseTrendPoint {
  key: string;
  label: string;
  /** Matching records in the Expense Total. */
  entryCount: number;
  /** Every matching record (in and not in the Expense Total). */
  recordCount: number;
  amount: number;
}

/** Matching records of one Category that are NOT in the Expense Total (shown, never added up). */
export interface ExpenseNotInTotalCategory {
  /** Category option ID, EMPTY_CATEGORY_ID, or null ("No Category"). */
  categoryId: string | null;
  label: string;
  colorIndex: number | null;
  /** The Category's treatment; null when the Category is empty or not a Bitrix24 option. */
  treatment: ExpenseTreatment | null;
  count: number;
  amount: number;
  /** Distinct "Not in Expense Total" reasons of these records. */
  reasons: string[];
}

export interface ExpenseReport {
  /** Sum of the filtered amounts IN THE EXPENSE TOTAL (accounting). */
  total: number;
  /** Matching records IN THE EXPENSE TOTAL (accounting). */
  entryCount: number;
  /** Every matching record (in and not in the Expense Total) — the rows of Expense items. */
  recordCount: number;
  /** Part of the total linked to deals / not linked to any deal. */
  dealLinkedTotal: number;
  generalTotal: number;
  linkedDealCount: number;
  /** Every Category counted as an expense (plus "No Category" when used), highest amount first. */
  byCategory: ExpenseCategoryTotal[];
  categoriesUsed: number;
  topCategory: ExpenseCategoryTotal | null;
  trend: ExpenseTrendPoint[];
  granularity: TrendGranularity;
  /** Every filtered record (in and not in the Expense Total), newest first. */
  rows: ExpenseItemRow[];
  /** Filtered records shown but NOT in the Expense Total (separate from all accounting figures). */
  notInTotal: { count: number; amount: number };
  /** The same records as `notInTotal`, per Category. */
  notInTotalByCategory: ExpenseNotInTotalCategory[];
  /** "How expenses are counted" per Category, for the matching "Essentials only" records. */
  countingSummary: EssentialsCategorySummary[];
  /** Matching records of the Bitrix24 "Expenses" smart process (all in the Expense Total). */
  expensesRecordCount: number;
  /** Present when a specific deal is selected. */
  dealSummary: ExpenseDealSummary | null;
}
