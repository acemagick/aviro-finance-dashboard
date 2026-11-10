/**
 * Domain types used by the dashboard.
 *
 * These are *our* clean shapes. Raw Bitrix24 shapes live in `bitrix.ts`
 * and are converted into these by `services/bitrixMappers.ts`.
 */

export type DealStatus = 'won' | 'inProgress' | 'lost';

export interface Pipeline {
  id: string;
  name: string;
}

export interface DealStage {
  id: string;
  name: string;
  pipelineId: string;
  sort: number;
}

export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  fullName: string;
  /** Primary department (first entry of Bitrix24 UF_DEPARTMENT). */
  departmentId: string | null;
  /** False for dismissed (inactive) Bitrix24 users. */
  active: boolean;
}

/** One installment payment recorded on a deal (Bitrix24 installment fields 1–7). */
export interface DealInstallment {
  /** 1 = 1st installment, 2 = 2nd, ... */
  number: number;
  amount: number;
  /** "Date of … Payment Received". `null` = amount recorded but no received date (not counted as received). */
  receivedDate: Date | null;
}

export interface Deal {
  id: string;
  title: string;
  /** Deal Amount. Used as income. */
  amount: number;
  currency: string;
  status: DealStatus;
  pipelineId: string;
  stageId: string;
  responsibleId: string;
  /** Taken from the responsible person's department. */
  departmentId: string | null;
  startDate: Date;
  createdAt: Date;
  siteName: string | null;
  projectType: string | null;
  plantCapacityKw: number | null;
  leadCategory: string | null;
  /**
   * "Total Project Cost". `null` = not filled in (no fallback to the Deal Amount).
   * Used only by the Income Dashboard tab; everything else keeps using `amount`.
   */
  projectCost: number | null;
  /** Installments with an amount above 0, in installment order. Empty when none are filled in. */
  installments: DealInstallment[];
}

/** Where an expense transaction comes from. */
export type ExpenseSource = 'expenses' | 'essentials';

/**
 * One expense transaction, from either Bitrix24 source:
 * - 'expenses':   the "Expenses" smart process (every record is an expense);
 * - 'essentials': the "Essentials only" smart process (only Categories whose rule is "expense").
 * `id` is unique across both sources, so no record is ever counted twice.
 */
export interface Expense {
  /** `${source}-${Bitrix24 item ID}`. */
  id: string;
  source: ExpenseSource;
  /** Bitrix24 item ID within its source. */
  sourceId: string;
  title: string;
  amount: number;
  currency: string;
  /** Bitrix24 "Essentials only" Category option ID. `null` for records without a Category (all "Expenses" records). */
  categoryId: string | null;
  /** The date that places the expense in a period (see the source's rules). */
  date: Date;
  /**
   * Bitrix24 user ID of the record's own employee field: "Employee Name" (a user field) for
   * "Expenses" records; for "Essentials only" the typed name when it matches exactly one user.
   * `null` when blank, when the source has no such field, or when the typed name is not one user.
   */
  employeeId: string | null;
  /** Company-structure department ID. `null` when blank or when the source has no such field. */
  departmentId: string | null;
  /** Site Name. `null` when blank or when the source has no site field. */
  siteName: string | null;
  /** Linked deal. `null` means a general expense (office rent, software, ...). */
  dealId: string | null;
}

/**
 * A record shown and filtered on the Expenses dashboard. The same transactions as `Expense`
 * plus every other real Bitrix24 record (any Category), with whether it is in the Expense Total.
 * Visibility and accounting are separate: "not in Expense Total" never means "hidden".
 */
export interface ExpenseRecord extends Expense {
  /** True exactly for the records that are also in `FinanceDataset.expenses` (the accounting list). */
  inExpenseTotal: boolean;
  /** Short reason when not in the Expense Total, e.g. "Income (money received)", "Failed stage". */
  notCountedReason: string | null;
  /** No amount on the record: shown as "—", matches only "Any amount" (`amount` is 0). */
  amountMissing: boolean;
  /** 'created' = no business date on the record, so its Created on day is used (and labelled). */
  dateSource: 'business' | 'created';
  /** Extra detail shown with the record, e.g. "Proforma Invoice". */
  note: string | null;
  /**
   * Employee / Department filter values: the Bitrix24 user / department ID when the record has
   * one (or its typed name matches exactly one), otherwise the typed value itself (`typed:` key),
   * matched exactly. `null` when the field is empty.
   */
  employeeKey: string | null;
  departmentKey: string | null;
  /** Record-level Responsible person (Bitrix24 user ID): the Employee filter value. `null` when empty. */
  responsibleId: string | null;
  /** The typed value exactly as in Bitrix24 when it is not linked to a user / department, else null. */
  employeeText: string | null;
  departmentText: string | null;
  /** Set when the record's Deal / Project field links to something that is not a deal, e.g. a lead. */
  nonDealLink: string | null;
}

/** A typed Employee / Department value that is not linked to a Bitrix24 user / department. */
export interface TypedFilterValue {
  /** Filter value (`typed:` + the value ignoring upper/lower case and extra spaces). */
  key: string;
  /** Dropdown label, e.g. "Kiran Aher — typed name (2 Bitrix24 users have this name)". */
  label: string;
}

/** How a Category counts in the finance dashboards (see ESSENTIALS_CATEGORY_RULES). */
export type ExpenseTreatment = 'expense' | 'income' | 'request' | 'advance' | 'purchase' | 'unresolved';

/** One option of the Bitrix24 "Essentials only" Category field, in Bitrix24 order. */
export interface ExpenseCategoryOption {
  /** Bitrix24 option ID. */
  id: string;
  /** Option text as configured in Bitrix24. */
  label: string;
  treatment: ExpenseTreatment;
  /** Why the Category is not counted (`null` for counted categories). */
  reason: string | null;
  /** Position in the category colour series (Bitrix24 order). */
  colorIndex: number;
}

/** What happened to the "Essentials only" records of one Category (shown so nothing is dropped silently). */
export interface EssentialsCategorySummary {
  /** Category option ID, or null for records without a Category. */
  categoryId: string | null;
  label: string;
  treatment: ExpenseTreatment;
  records: number;
  /** Records counted as expenses. */
  counted: number;
  countedAmount: number;
  /** Not counted: in the Bitrix24 failure stage. */
  failed: number;
  /** Not counted: no amount. */
  noAmount: number;
  /** Not counted: amount but no business date. */
  noDate: number;
  /** Counted records whose typed employee / department matched exactly one Bitrix24 user / department. */
  employeeMatched: number;
  departmentMatched: number;
  /** Not-counted types with an information amount (advances, purchases): sum of that amount. */
  infoAmount: number | null;
}

/** Everything the finance dashboards need, already cleaned up. */
export interface FinanceDataset {
  deals: Deal[];
  expenses: Expense[];
  pipelines: Pipeline[];
  stages: DealStage[];
  departments: Department[];
  employees: Employee[];
  /** Options of the Bitrix24 "Essentials only" Category field, in Bitrix24 order. */
  expenseCategoryOptions: ExpenseCategoryOption[];
  /** Per-Category counts of the "Essentials only" records (counted and not counted). */
  essentialsSummary: EssentialsCategorySummary[];
  /**
   * Every record the Expenses dashboard can show and filter (accounting expenses + all other real
   * Bitrix24 records). `expenses` above stays the accounting list (Expense Total, Net Revenue).
   */
  expenseRecords: ExpenseRecord[];
  /**
   * Typed Employee / Department values of the "Essentials only" list fields that are not linked to
   * one Bitrix24 user / department: every option of those lists (also unused) + values on records.
   */
  expenseTypedValues: { employees: TypedFilterValue[]; departments: TypedFilterValue[] };
}

export interface DateRange {
  start: Date;
  end: Date;
}

/** How the user picks the reporting period. */
export type PeriodType = 'day' | 'month' | 'quarter' | 'year' | 'custom';

/** The period part of any dashboard's filters (shared by Net Revenue, Income and Expenses). */
export interface PeriodSelection {
  period: PeriodType;
  /** Any date inside the selected day/month/quarter/year (not used for Custom). */
  anchorDate: Date;
  /** The exact period used for calculations. */
  dateRange: DateRange;
}

export interface NetRevenueFilters {
  period: PeriodType;
  /** Any date inside the selected day/month/quarter/year (not used for Custom). */
  anchorDate: Date;
  /** The exact period used for calculations. */
  dateRange: DateRange;
  /** A Bitrix24 deal ID, or null for all projects. */
  dealId: string | null;
  pipelineId: string | null;
  stageId: string | null;
  departmentId: string | null;
  responsibleId: string | null;
}

export type TrendGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface NetRevenueSummary {
  /** Sum of the installments received in the period by the deals in scope. */
  income: number;
  /** dealExpenses + generalExpenses. */
  expenses: number;
  dealExpenses: number;
  generalExpenses: number;
  netRevenue: number;
  /** Net revenue as % of income. `null` when there is no income. */
  marginPct: number | null;
  dealCount: number;
}

export interface DealNetRevenueRow {
  dealId: string;
  title: string;
  siteName: string | null;
  projectType: string | null;
  plantCapacityKw: number | null;
  startDate: Date;
  pipelineId: string;
  pipelineName: string;
  departmentId: string | null;
  stageId: string;
  stageName: string;
  responsibleName: string;
  income: number;
  expenses: number;
  netRevenue: number;
  marginPct: number | null;
}

export interface TrendPoint {
  key: string;
  label: string;
  income: number;
  expenses: number;
  netRevenue: number;
}

export interface StageNetRevenue {
  stageId: string;
  stageName: string;
  sort: number;
  dealCount: number;
  income: number;
  expenses: number;
  netRevenue: number;
}

/** One row of a "By Department" / "By Pipeline" breakdown. */
export interface BreakdownRow {
  id: string;
  label: string;
  dealCount: number;
  income: number;
  expenses: number;
  netRevenue: number;
  marginPct: number | null;
  /** True for general costs that don't belong to a pipeline/department. */
  isGeneral: boolean;
}

export interface CategoryExpense {
  /** Category option ID, or null for expenses without a Category. */
  categoryId: string | null;
  label: string;
  /** Position in the category colour series; null = "No Category". */
  colorIndex: number | null;
  amount: number;
  /** Share of total expenses. `null` when there are no expenses. */
  sharePct: number | null;
}

export interface NetRevenueReport {
  summary: NetRevenueSummary;
  dealRows: DealNetRevenueRow[];
  trend: TrendPoint[];
  granularity: TrendGranularity;
  byStage: StageNetRevenue[];
  byDepartment: BreakdownRow[];
  byPipeline: BreakdownRow[];
  byCategory: CategoryExpense[];
}
