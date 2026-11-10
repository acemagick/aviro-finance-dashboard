import type { SelectOption } from '../../components/SelectField';
import { EXPENSE_AMOUNT_RANGES } from '../../config/finance';
import { EMPTY_CATEGORY_ID, GENERAL_EXPENSES_DEAL_ID, NO_CATEGORY_ID, TYPED_VALUE_PREFIX, type ExpenseFilters } from '../../types/expenses';
import type { ExpenseRecord, FinanceDataset } from '../../types/finance';
import { EMPTY_CATEGORY_LABEL, NO_CATEGORY_LABEL } from '../../utils/expenseCategories';
import { formatDateRange } from '../../utils/dateRange';
import { employeeLabels, expenseInDeal, expenseMatchesFilters, siteKey } from '../../utils/expenses';
// Shared period helpers — the same ones Net Revenue and Income use.
import { ALL_VALUE, buildDealOptions, createDefaultPeriodSelection, periodEqual } from '../net-revenue/filters';

/** Starting filters: current year (same default as the other dashboards), everything else "All". */
export function createDefaultExpenseFilters(): ExpenseFilters {
  return {
    ...createDefaultPeriodSelection(),
    dealId: null,
    category: null,
    amountRange: 'any',
    employeeId: null,
    departmentId: null,
    siteName: null,
  };
}

export function expenseFiltersEqual(a: ExpenseFilters, b: ExpenseFilters): boolean {
  return (
    periodEqual(a, b) &&
    a.dealId === b.dealId &&
    a.category === b.category &&
    a.amountRange === b.amountRange &&
    a.employeeId === b.employeeId &&
    a.departmentId === b.departmentId &&
    a.siteName === b.siteName
  );
}

const byLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label);

/** Every deal (Linked Deal / Project) plus general expenses that have no deal. */
export function buildExpenseDealOptions(dataset: FinanceDataset): SelectOption[] {
  return buildDealOptions(dataset, { includeGeneral: true });
}

/**
 * Records of the selected Project / Deal (or of "General"), used to limit the other filter
 * options to that deal. `null` when no Project / Deal is selected (options stay global).
 * Uses the same deal rule as the filter itself (expense.dealId === deal.id). These are all the
 * records the dashboard shows (`expenseRecords`), also those not in the Expense Total.
 */
export function dealScopeExpenses(dataset: FinanceDataset, dealId: string | null): ExpenseRecord[] | null {
  if (dealId === null) return null;
  const knownDealIds = new Set(dataset.deals.map((deal) => deal.id));
  return dataset.expenseRecords.filter((expense) => expenseInDeal(expense, dealId, knownDealIds));
}

/**
 * Category options. Without a deal: every option of the Bitrix24 Category field, in Bitrix24
 * order, whether or not it has records (Categories that are not counted as expenses show their
 * records marked "Not in Expense Total"), plus "No Category" when some records have none
 * (records of the "Expenses" smart process) and "Category not filled in" when some "Essentials
 * only" records have an empty Category. With a deal (`scope`): only the Categories its records use.
 */
export function buildCategoryOptions(dataset: FinanceDataset, scope: readonly ExpenseRecord[] | null = null): SelectOption[] {
  const records = scope ?? dataset.expenseRecords;
  const used = new Set(records.map((record) => record.categoryId));
  return [
    { value: ALL_VALUE, label: 'All categories' },
    ...dataset.expenseCategoryOptions
      .filter((option) => scope === null || used.has(option.id))
      .map((option) => ({ value: option.id, label: option.label })),
    ...(used.has(null) ? [{ value: NO_CATEGORY_ID, label: NO_CATEGORY_LABEL }] : []),
    ...(used.has(EMPTY_CATEGORY_ID) ? [{ value: EMPTY_CATEGORY_ID, label: EMPTY_CATEGORY_LABEL }] : []),
  ];
}

export function buildAmountOptions(): SelectOption[] {
  return EXPENSE_AMOUNT_RANGES.map((range) => ({ value: range.id, label: range.label }));
}

/** Distinct non-blank IDs, in first-seen order. */
function usedIds(values: ReadonlyArray<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))];
}

/** Label of every Employee / Department filter value: Bitrix24 users / departments + typed values. */
export function filterValueLabels(dataset: FinanceDataset): { employee: Map<string, string>; department: Map<string, string> } {
  return {
    employee: new Map([
      ...employeeLabels(dataset.employees),
      ...dataset.expenseTypedValues.employees.map((value) => [value.key, value.label] as const),
    ]),
    department: new Map([
      ...dataset.departments.map((department) => [department.id, department.name] as const),
      ...dataset.expenseTypedValues.departments.map((value) => [value.key, value.label] as const),
    ]),
  };
}

/** Options for the given filter values, labelled; unknown IDs get e.g. "User #12". */
function keyedOptions(keys: readonly string[], labels: ReadonlyMap<string, string>, unknown: (key: string) => string): SelectOption[] {
  return [...new Set(keys)].map((key) => ({ value: key, label: labels.get(key) ?? unknown(key) })).sort(byLabel);
}

/**
 * Employee options: the active Bitrix24 users who are the record-level Responsible person of at
 * least one shown record (all, or the selected deal's `scope`), each by user ID. Dismissed
 * (inactive) users are not listed, even with records. Users are never merged: only when several
 * listed users have the same name are they told apart by ID (e.g. "Kiran Aher — User #68").
 * Never the "Employee Name" field, and never the deal's Responsible person.
 */
export function buildEmployeeOptions(dataset: FinanceDataset, scope: readonly ExpenseRecord[] | null = null): SelectOption[] {
  const used = new Set(usedIds((scope ?? dataset.expenseRecords).map((record) => record.responsibleId)));
  const listed = dataset.employees.filter((employee) => employee.active && used.has(employee.id));
  const options = [...employeeLabels(listed)].map(([value, label]) => ({ value, label: label.trim().replace(/\s+/g, ' ') }));
  return [{ value: ALL_VALUE, label: 'All employees' }, ...options.sort(byLabel)];
}

/**
 * Department options. Without a deal: every department of the Bitrix24 company structure, every
 * typed value of the "Essentials only" department lists that is not exactly one company
 * department (e.g. "EV Business" — never mapped to a parent or similar department), and any
 * other value on a record; also those without records. With a deal (`scope`): only the values
 * on its records.
 */
export function buildExpenseDepartmentOptions(dataset: FinanceDataset, scope: readonly ExpenseRecord[] | null = null): SelectOption[] {
  const labels = filterValueLabels(dataset).department;
  const used = usedIds((scope ?? dataset.expenseRecords).map((record) => record.departmentKey));
  const keys = scope === null ? [...labels.keys(), ...used] : used;
  return [{ value: ALL_VALUE, label: 'All departments' }, ...keyedOptions(keys, labels, (key) => `Department #${key}`)];
}

/**
 * Distinct Site Names found on the shown records (all, or the selected deal's `scope`).
 * Site Name is typed by hand (there is no Bitrix24 list); names that differ only in upper/lower
 * case or spacing are one site, shown as its most used spelling.
 */
export function buildSiteOptions(dataset: FinanceDataset, scope: readonly ExpenseRecord[] | null = null): SelectOption[] {
  const spellings = new Map<string, Map<string, number>>();
  for (const expense of scope ?? dataset.expenseRecords) {
    if (!expense.siteName) continue;
    const variants = spellings.get(siteKey(expense.siteName)) ?? new Map<string, number>();
    variants.set(expense.siteName, (variants.get(expense.siteName) ?? 0) + 1);
    spellings.set(siteKey(expense.siteName), variants);
  }
  const sites = [...spellings.values()].map((variants) => [...variants].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
  return [{ value: ALL_VALUE, label: 'All sites' }, ...sites.map((site) => ({ value: site, label: site })).sort(byLabel)];
}

export interface DependentFilterOptions {
  /** True when the options are limited to the selected Project / Deal. */
  scopedToDeal: boolean;
  category: SelectOption[];
  employee: SelectOption[];
  department: SelectOption[];
  site: SelectOption[];
}

/** The Category / Employee / Department / Site options for the selected Project / Deal (global when none). */
export function buildDependentOptions(dataset: FinanceDataset, dealId: string | null): DependentFilterOptions {
  const scope = dealScopeExpenses(dataset, dealId);
  return {
    scopedToDeal: scope !== null,
    category: buildCategoryOptions(dataset, scope),
    employee: buildEmployeeOptions(dataset, scope),
    department: buildExpenseDepartmentOptions(dataset, scope),
    site: buildSiteOptions(dataset, scope),
  };
}

/**
 * Clears (back to "All") any Category / Employee / Department / Site choice that is not one of
 * the given options, e.g. an employee from the previously selected deal. Valid choices are kept.
 */
export function pruneToOptions(filters: ExpenseFilters, options: DependentFilterOptions): ExpenseFilters {
  const has = (list: SelectOption[], value: string | null) => value === null || list.some((option) => option.value === value);
  const hasSite = filters.siteName === null || options.site.some((option) => option.value !== ALL_VALUE && siteKey(option.value) === siteKey(filters.siteName!));
  return {
    ...filters,
    category: has(options.category, filters.category) ? filters.category : null,
    employeeId: has(options.employee, filters.employeeId) ? filters.employeeId : null,
    departmentId: has(options.department, filters.departmentId) ? filters.departmentId : null,
    siteName: hasSite ? filters.siteName : null,
  };
}

/**
 * Plain-language list of the applied filters other than Project / Deal, e.g.
 * ['Period 01 Jan 2026 – 31 Dec 2026', 'Employee: Sai Prasanna Kolluru'].
 * Used to explain why a selected deal's card counts more expenses than the filtered list.
 */
export function describeNonDealFilters(dataset: FinanceDataset, filters: ExpenseFilters): string[] {
  const parts = [`Period ${formatDateRange(filters.dateRange)}`];
  if (filters.category !== null) {
    const label =
      filters.category === NO_CATEGORY_ID
        ? NO_CATEGORY_LABEL
        : filters.category === EMPTY_CATEGORY_ID
          ? EMPTY_CATEGORY_LABEL
          : (dataset.expenseCategoryOptions.find((option) => option.id === filters.category)?.label ?? filters.category);
    parts.push(`Category: ${label}`);
  }
  const labels = filterValueLabels(dataset);
  if (filters.employeeId !== null) parts.push(`Employee: ${labels.employee.get(filters.employeeId) ?? `User #${filters.employeeId}`}`);
  if (filters.departmentId !== null) {
    parts.push(`Department: ${labels.department.get(filters.departmentId) ?? `Department #${filters.departmentId}`}`);
  }
  if (filters.siteName !== null) parts.push(`Site: ${filters.siteName}`);
  if (filters.amountRange !== 'any') {
    parts.push(`Amount: ${EXPENSE_AMOUNT_RANGES.find((range) => range.id === filters.amountRange)?.label ?? filters.amountRange}`);
  }
  return parts;
}

/**
 * The options, plus the selected value when it is not one of them (e.g. it is no longer in
 * Bitrix24 after Refresh data), so the field always shows the filter that is really applied.
 */
export function withSelectedOption(options: SelectOption[], value: string | null, label: string): SelectOption[] {
  if (value === null || options.some((option) => option.value === value)) return options;
  return [...options, { value, label }];
}

/** Label for a selected value that is not in the current options. */
export function missingValueLabel(dataset: FinanceDataset, field: 'deal' | 'employee' | 'department' | 'category', value: string): string {
  const labels = filterValueLabels(dataset);
  if (field === 'employee' && labels.employee.has(value)) return labels.employee.get(value)!;
  if (field === 'department' && labels.department.has(value)) return labels.department.get(value)!;
  const what = { deal: 'Deal', employee: 'Employee', department: 'Department', category: 'Category' }[field];
  const shown = value.startsWith(TYPED_VALUE_PREFIX) ? `“${value.slice(TYPED_VALUE_PREFIX.length)}”` : `#${value}`;
  return `${what} ${shown} (no longer in Bitrix24)`;
}

const ALL_DATES = { start: new Date(0), end: new Date(8.64e15) };

/** Each applied filter on its own, with how its "no records" explanation is worded. */
function appliedDimensions(filters: ExpenseFilters): Array<{ only: Partial<ExpenseFilters>; noun: string; phrase: string }> {
  const dims: Array<{ only: Partial<ExpenseFilters>; noun: string; phrase: string }> = [];
  if (filters.dealId !== null) {
    dims.push({
      only: { dealId: filters.dealId },
      noun: 'project / deal',
      phrase: filters.dealId === GENERAL_EXPENSES_DEAL_ID ? 'are not linked to a deal' : 'are linked to this project / deal',
    });
  }
  if (filters.category !== null) dims.push({ only: { category: filters.category }, noun: 'category', phrase: 'have this category' });
  if (filters.employeeId !== null) dims.push({ only: { employeeId: filters.employeeId }, noun: 'employee', phrase: 'have this employee assigned' });
  if (filters.departmentId !== null) {
    dims.push({ only: { departmentId: filters.departmentId }, noun: 'department', phrase: 'have this department assigned' });
  }
  if (filters.siteName !== null) dims.push({ only: { siteName: filters.siteName }, noun: 'site', phrase: 'have this site name' });
  if (filters.amountRange !== 'any') dims.push({ only: { amountRange: filters.amountRange }, noun: 'amount', phrase: 'have an amount in this range' });
  return dims;
}

/**
 * Why no record matches the applied filters, in plain words. Each applied filter is first
 * checked on its own (all dates): a value that no record has gets "No records available: No
 * matching Bitrix24 records currently have this department assigned." Then the period, then
 * the combination. Empty when some record matches.
 */
export function explainEmptyResult(dataset: FinanceDataset, filters: ExpenseFilters): string[] {
  const knownDealIds = new Set(dataset.deals.map((deal) => deal.id));
  const none = createDefaultExpenseFilters();
  const count = (partial: Partial<ExpenseFilters>) =>
    dataset.expenseRecords.filter((record) => expenseMatchesFilters(record, { ...none, ...partial }, knownDealIds)).length;
  if (count({ ...filters }) > 0) return [];
  const dims = appliedDimensions(filters);
  const absent = dims.filter((dim) => count({ dateRange: ALL_DATES, ...dim.only }) === 0);
  if (absent.length > 0) {
    return absent.map((dim) => `No records available: No matching Bitrix24 records currently ${dim.phrase}.`);
  }
  if (count({ dateRange: filters.dateRange }) === 0) {
    return ['No records available: No Bitrix24 records have a date in the selected period.'];
  }
  const notInPeriod = dims.filter((dim) => count({ dateRange: filters.dateRange, ...dim.only }) === 0);
  if (notInPeriod.length > 0) {
    return notInPeriod.map((dim) => `No records ${dim.phrase} in the selected period (records exist on other dates).`);
  }
  return ['Records exist for each selected filter, but none match all of them together.'];
}

/**
 * Notes on records left out only because a filtered field is empty in Bitrix24, e.g. "12 records
 * in this selection have no Department in Bitrix24 (shown as —), so they cannot match a
 * Department filter." Each is counted with all the other applied filters.
 */
export function emptyFieldNotes(dataset: FinanceDataset, filters: ExpenseFilters): string[] {
  const knownDealIds = new Set(dataset.deals.map((deal) => deal.id));
  const notes: string[] = [];
  const check = (applied: boolean, without: Partial<ExpenseFilters>, isEmpty: (record: ExpenseRecord) => boolean, text: (n: string) => string) => {
    if (!applied) return;
    const n = dataset.expenseRecords.filter((record) => isEmpty(record) && expenseMatchesFilters(record, { ...filters, ...without }, knownDealIds)).length;
    if (n > 0) notes.push(text(`${n.toLocaleString('en-IN')} record${n === 1 ? '' : 's'}`));
  };
  const field = (name: string) => (n: string) =>
    `${n} in this selection ${n.startsWith('1 ') ? 'has' : 'have'} no ${name} in Bitrix24 (shown as —), so ${n.startsWith('1 ') ? 'it cannot' : 'they cannot'} match ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name} filter.`;
  check(filters.employeeId !== null, { employeeId: null }, (record) => record.responsibleId === null, (n) =>
    `${n} in this selection ${n.startsWith('1 ') ? 'has' : 'have'} no Responsible person in Bitrix24, so ${n.startsWith('1 ') ? 'it cannot' : 'they cannot'} match an Employee filter.`);
  check(filters.departmentId !== null, { departmentId: null }, (record) => record.departmentKey === null, field('Department'));
  check(filters.siteName !== null, { siteName: null }, (record) => record.siteName === null, field('Site name'));
  check(filters.amountRange !== 'any', { amountRange: 'any' }, (record) => record.amountMissing, (n) =>
    `${n} in this selection ${n.startsWith('1 ') ? 'has' : 'have'} no amount in Bitrix24 (shown as —), so ${n.startsWith('1 ') ? 'it is' : 'they are'} shown only with “Any amount”.`);
  return notes;
}
