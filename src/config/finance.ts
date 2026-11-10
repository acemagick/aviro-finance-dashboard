import type { ExpenseAmountRangeId } from '../types/expenses';
import type { DealStatus } from '../types/finance';

/**
 * Central finance settings. Change business rules here
 * instead of hunting through components.
 */

export const LOCALE = 'en-IN';
export const CURRENCY = 'INR';

/**
 * INCOME RULE (AVIRO proposal: "Income from revenue value already captured on Deal").
 * Income = the Deal Amount (Bitrix24 field OPPORTUNITY) of every deal in scope,
 * whatever stage the deal is in.
 */

/** Which deal date decides the period a deal's income belongs to. */
export type IncomeDateField = 'startDate' | 'createdAt';
export const INCOME_DATE_FIELD: IncomeDateField = 'startDate';

/** Keep `false` unless AVIRO confirms lost deals should not count as income. */
export const EXCLUDE_LOST_DEALS_FROM_INCOME: boolean = false;

/**
 * Bitrix24 custom field codes for AVIRO's deal fields, verified against
 * crm.deal.fields. The server selects the same codes (server/index.js).
 * List fields return option IDs; the mapper turns them into text.
 */
export const DEAL_CUSTOM_FIELDS = {
  /** "Site Name" (text, multiple). */
  siteName: 'UF_CRM_6911972A7FFDB',
  /** "Type of Project" (list: DCR / NON DCR). */
  projectType: 'UF_CRM_68B1565B081A1',
  /** "Required Plant Capacity (Kwp)" (text, e.g. "40 kwp"). */
  plantCapacityKw: 'UF_CRM_69141F2229AB2',
  /** "Lead Category" (list, multiple). */
  leadCategory: 'UF_CRM_68B92E527B456',
  /** "Total Project Cost" (money, "2000000|INR"). Income Dashboard tab only; empty = not filled in. */
  totalProjectCost: 'UF_CRM_6A71CB860E243',
} as const satisfies Record<string, `UF_CRM_${string}`>;

/**
 * INSTALLMENTS — existing Bitrix24 deal fields (verified against crm.deal.fields).
 * Each installment is a money field ("50000|INR"; the 2nd one allows several values,
 * which are added up) plus a "Date of … Payment Received" date field.
 * The server selects the same codes (server/index.js).
 *
 * Rules (confirmed with AVIRO):
 * - An installment counts as RECEIVED only when its received date is filled in;
 *   amounts without a date are shown separately and stay in Pending.
 * - Pending = Deal Amount − installments received, never below 0; deals where
 *   received is more than the Deal Amount are flagged instead.
 */
export const DEAL_INSTALLMENT_FIELDS: ReadonlyArray<{
  number: number;
  amount: `UF_CRM_${string}`;
  receivedDate: `UF_CRM_${string}`;
}> = [
  { number: 1, amount: 'UF_CRM_69044E5DA4CB6', receivedDate: 'UF_CRM_69044E5DC59B3' },
  { number: 2, amount: 'UF_CRM_69044E5DB52CC', receivedDate: 'UF_CRM_69044E5DD5D03' },
  { number: 3, amount: 'UF_CRM_69044E5E07F93', receivedDate: 'UF_CRM_69044E5DECBE9' },
  { number: 4, amount: 'UF_CRM_69B151FB1FFA0', receivedDate: 'UF_CRM_69B151FAEE59B' },
  { number: 5, amount: 'UF_CRM_69B151FB74D81', receivedDate: 'UF_CRM_69B151FB591A8' },
  { number: 6, amount: 'UF_CRM_69B151FC00994', receivedDate: 'UF_CRM_69B151FBABDB8' },
  { number: 7, amount: 'UF_CRM_69B151FC54F33', receivedDate: 'UF_CRM_69B151FC33121' },
];

/**
 * Field codes of the Bitrix24 "Expenses" smart process (entityTypeId 1048),
 * verified against crm.item.fields. The server selects the same codes.
 * Name and created date are standard fields.
 */
export const EXPENSE_FIELDS = {
  /** "Expense Amount" (money, sent as "1500|INR"). */
  amount: 'ufCrm12_1790320689',
  /** "Expense Category" (list). Not used: the dashboard's Category is the "Essentials only" Category field. */
  category: 'ufCrm12_1790320851',
  /** "Deal / Project" (CRM link). */
  dealLink: 'ufCrm12_1790320964',
  /** "Employee Name" (employee: a Bitrix24 user ID): the record's Employee. Empty stays empty (Responsible is not used). */
  employee: 'ufCrm12_1790708101',
  /** "Department" (company structure section: a department ID from department.get). */
  department: 'ufCrm12_1790709292',
  /** "Site Name" (text). */
  siteName: 'ufCrm12_1790710037',
  /** "Expense Date" (date). Blank → the item's created date is used. */
  expenseDate: 'ufCrm12_1790710158',
} as const satisfies Record<string, `ufCrm${string}`>;

/**
 * EXPENSE CATEGORY — the Bitrix24 "Category" field of the "Essentials only" smart process
 * (entityTypeId 1040), verified against crm.item.fields. Its options are loaded from Bitrix24
 * (never listed here), so an option added in Bitrix24 appears in the dashboard after a refresh.
 * The server selects the same codes (server/index.js, ESSENTIALS_FIELDS).
 */
export const ESSENTIALS_FIELDS = {
  /** "Category" (list). */
  category: 'ufCrm8_1776449281117',
  /** "Deal" (CRM relation to a deal). The only Deal/Project link on this process. */
  dealLink: 'parentId2',
} as const;

/** "Expenses Bill Amount" (money): the ONLY amount used for expenses, in every Category. */
export const EXPENSES_BILL_AMOUNT_FIELD = 'ufCrm8_1777130032977';
/** "Expenses Bill Date": the date that places an expense in a period. */
export const EXPENSES_BILL_DATE_FIELD = 'ufCrm8_1777129155784';

/**
 * EXPENSE RULE (confirmed by AVIRO), the same for every "Essentials only" expense Category configured
 * in Bitrix24 (also a Category added later, or left empty; NON_EXPENSE_CATEGORY_IDS are left out):
 * - Amount = the record's "Expenses Bill Amount". No other amount field is ever used (no fallback
 *   to Total Invoice Amount, Total Amount, etc.).
 * - A record is in the Expense Total when its Expenses Bill Amount is filled in (above 0), it has
 *   its bill date, and it is not in the Bitrix24 failure stage ("Failed"). Records with any other
 *   payment status (Pending, Hold, Approval Pending, Partial) are counted.
 * - Every other record is still listed (with its details, its Expenses Bill Amount if any, and why
 *   it is not counted), but never adds anything to a total.
 *
 * Per Category (keyed by the Bitrix24 option ID; names in comments are only for reading) the
 * fields below give the bill date and how the record is shown and filtered. Employee / Department
 * come from typed lists, and are filled only when the typed text matches exactly one Bitrix24
 * user / company-structure department (ignoring upper/lower case and extra spaces).
 */
export interface EssentialsCategoryRule {
  /** Bill date field, or several in order of preference (first filled in). Required to be counted. */
  dateField: `ufCrm${string}` | readonly `ufCrm${string}`[];
  /**
   * Date fields that place a record WITHOUT a bill date in a period for display only (it is not
   * counted). Without them, or when empty, the record's Created on day is shown (labelled).
   */
  displayDateFields?: readonly `ufCrm${string}`[];
  /** Text field with the site, or null when the category has none. */
  siteField: `ufCrm${string}` | null;
  /** List field with the employee's name, or null when the category has none. */
  employeeField: `ufCrm${string}` | null;
  /** List field with the department's name, or null when the category has none. */
  departmentField: `ufCrm${string}` | null;
  /** A list field shown with the record, e.g. "Type of Invoice". */
  noteField?: `ufCrm${string}`;
}

/** "Expenses Submission" fields: also used for a Category left empty or not listed below. */
export const DEFAULT_CATEGORY_RULE: EssentialsCategoryRule = {
  dateField: EXPENSES_BILL_DATE_FIELD,
  siteField: 'ufCrm8_1777130814106', // Site Name for Expenses
  employeeField: 'ufCrm8_1777129341560', // Employee Name (list)
  departmentField: 'ufCrm8_1777130112267', // Expenses Bill Department (list)
};

export const ESSENTIALS_CATEGORY_RULES: Readonly<Record<string, EssentialsCategoryRule>> = {
  // "Expenses Submission": employee expense bills.
  '7016': DEFAULT_CATEGORY_RULE,
  // "Vendor Invoice Submission": Expenses Bill Date, else Date of Vendor Bill.
  '6448': {
    dateField: [EXPENSES_BILL_DATE_FIELD, 'ufCrm8_1776448970791'], // Expenses Bill Date, else Date of Vendor Bill
    siteField: null,
    employeeField: null,
    departmentField: 'ufCrm8_1776449169791', // Vendor Billing to Department (list)
  },
  // "Material Requisition Submission".
  '7034': {
    dateField: EXPENSES_BILL_DATE_FIELD,
    employeeField: 'ufCrm8_1778141185952', // Responsible Person (list)
    departmentField: null,
    siteField: 'ufCrm8_1786693673017', // Site Name (For Material Requisition)
  },
  // "Vendor Advance Payment".
  '7276': {
    dateField: EXPENSES_BILL_DATE_FIELD,
    employeeField: 'ufCrm8_1777129341560', // Employee Name (list)
    departmentField: null,
    siteField: null,
  },
  // "Material Purchase Form".
  '7544': {
    dateField: EXPENSES_BILL_DATE_FIELD,
    displayDateFields: ['ufCrm8_1778196408860'], // Tax Invoice/PI Date
    employeeField: 'ufCrm8_1778141185952', // Responsible Person (list)
    departmentField: 'ufCrm8_1778195902330', // Department for which material purchase (list)
    siteField: 'ufCrm8_1788247302195', // Site Name (For Material Purchase)
    noteField: 'ufCrm8_1778196279862', // Type of Invoice (Proforma / Tax Invoice)
  },
};

/**
 * Category options of the Bitrix24 Category field that are NOT expenses (confirmed by AVIRO): they
 * and their records are left out of the Expenses dashboard entirely (category list, chips, chart,
 * counts, Expense items, totals). The Bitrix24 data itself is untouched.
 * - 7464 "Payment Collection": money received from customers.
 */
export const NON_EXPENSE_CATEGORY_IDS: ReadonlySet<string> = new Set(['7464']);

/** Short labels for records listed but NOT in the Expense Total. */
export const NOT_IN_TOTAL_LABELS = {
  failed: 'Failed stage',
  noAmount: 'No Expenses Bill Amount',
  noDate: 'No bill date',
} as const;

/**
 * Margin badges: green at or above this %, amber between 0 and this %, red below 0.
 * A presentation choice only — adjust once AVIRO shares its target margin.
 */
export const HEALTHY_MARGIN_PCT = 20;

/**
 * INCOME DASHBOARD — deal status groups (Won / In progress / Lost).
 *
 * A deal's status comes from Bitrix24's STAGE_SEMANTIC_ID, which every
 * Bitrix24 stage has: "S" = success, "P" = in progress, "F" = failure.
 * In AVIRO's Solar sales pipeline the success stage is "Close deal", so:
 *   Won         = deals in "Close deal"
 *   In progress = deals in any other active stage (Site Survey … Invoicing and Accounting)
 *   Lost        = deals in a failure stage (only shown when such deals exist)
 * ASSUMPTION to confirm with AVIRO once the real API is connected.
 */
export const INCOME_STATUS_GROUPS: ReadonlyArray<{ status: DealStatus; label: string; description: string }> = [
  { status: 'won', label: 'Won', description: 'Deals in the "Close deal" stage' },
  { status: 'inProgress', label: 'In progress', description: 'Deals in an active stage' },
  { status: 'lost', label: 'Lost', description: 'Deals in a lost stage' },
];

/** EXPENSES DASHBOARD — Amount filter choices (min included, max not included). */
export const EXPENSE_AMOUNT_RANGES: ReadonlyArray<{ id: ExpenseAmountRangeId; label: string; min: number | null; max: number | null }> = [
  { id: 'any', label: 'Any amount', min: null, max: null },
  { id: 'under-10k', label: 'Under ₹10,000', min: null, max: 10_000 },
  { id: '10k-50k', label: '₹10,000 – ₹50,000', min: 10_000, max: 50_000 },
  { id: '50k-2l', label: '₹50,000 – ₹2,00,000', min: 50_000, max: 200_000 },
  { id: '2l-10l', label: '₹2,00,000 – ₹10,00,000', min: 200_000, max: 1_000_000 },
  { id: 'over-10l', label: '₹10,00,000 and above', min: 1_000_000, max: null },
];
