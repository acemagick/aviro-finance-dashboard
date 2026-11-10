import { parseISO } from 'date-fns';
import {
  DEAL_CUSTOM_FIELDS,
  DEAL_INSTALLMENT_FIELDS,
  DEFAULT_CATEGORY_RULE,
  ESSENTIALS_CATEGORY_RULES,
  ESSENTIALS_FIELDS,
  EXPENSES_BILL_AMOUNT_FIELD,
  EXPENSE_FIELDS,
  NON_EXPENSE_CATEGORY_IDS,
  NOT_IN_TOTAL_LABELS,
} from '../config/finance';
import type {
  BitrixDeal,
  BitrixDealCategory,
  BitrixDealStage,
  BitrixDepartment,
  BitrixEssentialsItem,
  BitrixExpenseItem,
  BitrixFieldOptions,
  BitrixFieldValue,
  BitrixStageSemantic,
  BitrixUser,
} from '../types/bitrix';
import type {
  Deal,
  DealInstallment,
  DealStage,
  DealStatus,
  Department,
  Employee,
  EssentialsCategorySummary,
  Expense,
  ExpenseCategoryOption,
  ExpenseRecord,
  FinanceDataset,
  TypedFilterValue,
  Pipeline,
} from '../types/finance';
import { EMPTY_CATEGORY_ID, TYPED_VALUE_PREFIX } from '../types/expenses';

/**
 * Converters from raw Bitrix24 shapes to our clean domain types.
 * Keeping this in one place means API quirks never leak into the UI.
 */

export function toDealStatus(semantic: BitrixStageSemantic): DealStatus {
  switch (semantic) {
    case 'S':
      return 'won';
    case 'F':
      return 'lost';
    default:
      return 'inProgress';
  }
}

/** Bitrix24 sends amounts as strings like "1148364.00". Invalid/empty → 0. */
export function parseAmount(value: string | null | undefined): number {
  const amount = Number(value);
  return value && Number.isFinite(amount) ? amount : 0;
}

/** Money fields come as "1500|INR" (amount|currency). */
export function parseMoney(value: BitrixFieldValue, fallbackCurrency: string): { amount: number; currency: string } {
  const [amount, currency] = String(firstValue(value) ?? '').split('|');
  return { amount: parseAmount(amount), currency: currency?.trim() || fallbackCurrency };
}

/** Multiple fields arrive as arrays; single fields as one value. */
function firstValue(value: BitrixFieldValue): string | number | boolean | null | undefined {
  return Array.isArray(value) ? value[0] : (value as string | number | boolean | null | undefined);
}

function valuesOf(value: BitrixFieldValue): string[] {
  const list: unknown[] = Array.isArray(value) ? value : [value];
  return list
    .filter((item) => item !== null && item !== undefined && item !== false)
    .map((item) => String(item).trim())
    .filter(Boolean);
}

/** Empty strings from Bitrix24 become `null`. Multiple values are joined. */
function textOrNull(value: BitrixFieldValue): string | null {
  const values = valuesOf(value);
  return values.length > 0 ? values.join(', ') : null;
}

/** List (enumeration) fields hold option IDs; turn them into their text. Unknown IDs are kept as-is. */
function optionTextOrNull(value: BitrixFieldValue, options: Readonly<Record<string, string>> | undefined): string | null {
  const values = valuesOf(value).map((id) => options?.[id] ?? id);
  return values.length > 0 ? values.join(', ') : null;
}

/** First number in the text, so "40 kwp" → 40 and "1,200 kW" → 1200. */
function numberOrNull(value: BitrixFieldValue): number | null {
  const match = textOrNull(value)?.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function dateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Bitrix24 "date" fields are calendar days, sent as midnight in the portal's timezone
 * (e.g. "2026-09-01T03:00:00+03:00"). Keep the calendar day itself (local midnight), so a
 * payment on 01 Sep is on 01 Sep in the Day/Month/Custom filters, whatever the viewer's timezone.
 */
function calendarDateOrNull(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Stage IDs in non-default pipelines look like "C2:UC_XXXX".
 * Stages from crm.status.list give the pipeline in CATEGORY_ID.
 */
export function mapBitrixDealStage(stage: BitrixDealStage): DealStage {
  return {
    id: stage.STATUS_ID,
    name: stage.NAME,
    pipelineId: String(stage.CATEGORY_ID ?? '0'),
    sort: Number(stage.SORT) || 0,
  };
}

export function mapBitrixUser(user: BitrixUser): Employee {
  const primaryDepartment = user.UF_DEPARTMENT?.[0];
  return {
    id: String(user.ID),
    fullName: `${user.NAME ?? ''} ${user.LAST_NAME ?? ''}`.trim() || `User ${user.ID}`,
    departmentId: primaryDepartment === undefined || primaryDepartment === null ? null : String(primaryDepartment),
    active: user.ACTIVE !== false,
  };
}

export function mapBitrixDepartment(department: BitrixDepartment): Department {
  return { id: String(department.ID), name: department.NAME };
}

export function mapBitrixDealCategory(category: BitrixDealCategory): Pipeline {
  return { id: String(category.id), name: category.name };
}

/** Adds up every value of a money field ("50000|INR", or a list of them for multiple fields). Empty → 0. */
function sumMoney(value: BitrixFieldValue): number {
  const values: unknown[] = Array.isArray(value) ? value : [value];
  return values.reduce<number>((total, item) => total + parseMoney(item as BitrixFieldValue, 'INR').amount, 0);
}

/** A single money field ("2000000|INR") as its amount, or `null` when it is not filled in. */
function moneyOrNull(value: BitrixFieldValue): number | null {
  const text = textOrNull(value);
  if (text === null || text.split('|')[0].trim() === '') return null;
  return parseMoney(text, 'INR').amount;
}

/** Installments 1–7 of a deal. Installments without an amount are left out. */
function mapInstallments(deal: BitrixDeal): DealInstallment[] {
  return DEAL_INSTALLMENT_FIELDS.map((field) => ({
    number: field.number,
    amount: sumMoney(deal[field.amount]),
    receivedDate: calendarDateOrNull(textOrNull(deal[field.receivedDate])),
  })).filter((installment) => installment.amount > 0);
}

export function mapBitrixDeal(
  deal: BitrixDeal,
  employeesById: ReadonlyMap<string, Employee>,
  fieldOptions: BitrixFieldOptions['deal'] = {},
): Deal {
  const createdAt = dateOrNull(deal.DATE_CREATE) ?? new Date(0);
  return {
    id: String(deal.ID),
    title: deal.TITLE ?? `Deal #${deal.ID}`,
    amount: parseAmount(deal.OPPORTUNITY),
    currency: deal.CURRENCY_ID || 'INR',
    status: toDealStatus(deal.STAGE_SEMANTIC_ID),
    pipelineId: String(deal.CATEGORY_ID ?? '0'),
    stageId: deal.STAGE_ID,
    responsibleId: String(deal.ASSIGNED_BY_ID ?? ''),
    departmentId: employeesById.get(String(deal.ASSIGNED_BY_ID))?.departmentId ?? null,
    // Start Date is a calendar day (sent as midnight UTC), so keep the day itself whatever the
    // viewer's timezone. Deals without a Start Date fall back to their created date.
    startDate: calendarDateOrNull(deal.BEGINDATE) ?? createdAt,
    createdAt,
    siteName: textOrNull(deal[DEAL_CUSTOM_FIELDS.siteName]),
    projectType: optionTextOrNull(deal[DEAL_CUSTOM_FIELDS.projectType], fieldOptions[DEAL_CUSTOM_FIELDS.projectType]),
    plantCapacityKw: numberOrNull(deal[DEAL_CUSTOM_FIELDS.plantCapacityKw]),
    leadCategory: optionTextOrNull(deal[DEAL_CUSTOM_FIELDS.leadCategory], fieldOptions[DEAL_CUSTOM_FIELDS.leadCategory]),
    projectCost: moneyOrNull(deal[DEAL_CUSTOM_FIELDS.totalProjectCost]),
    installments: mapInstallments(deal),
  };
}

// ---------------------------------------------------------------------------
// Expenses smart process
// ---------------------------------------------------------------------------

/** Site names are typed by hand: trim and collapse repeated spaces so equal names match. */
function siteNameOrNull(value: BitrixFieldValue): string | null {
  return textOrNull(value)?.replace(/\s+/g, ' ') ?? null;
}

let reportedUnlinkableDealLink = false;

/**
 * Reads the deal ID from the expense "Deal / Project" CRM-link field.
 * - Linked to several entity types → values look like "D_13088" (deal) or "L_5" (lead).
 * - Linked to deals only → the value is the plain deal ID.
 * Anything else (e.g. a lead) is not a deal, so the expense is treated as general.
 */
export function toLinkedDealId(value: BitrixFieldValue, linkTypes: readonly string[]): string | null {
  const raw = valuesOf(value)[0];
  if (!raw) return null;

  const prefixed = /^D_(\d+)$/.exec(raw);
  if (prefixed) return prefixed[1];
  if (/^\d+$/.test(raw) && linkTypes.length === 1 && linkTypes[0] === 'DEAL') return raw;

  if (!reportedUnlinkableDealLink) {
    reportedUnlinkableDealLink = true;
    console.warn(
      `[AVIRO] Expense "Deal / Project" value "${raw}" is not a deal (field links to: ${linkTypes.join(', ') || 'unknown'}) — counted as a general expense.`,
    );
  }
  return null;
}

export interface ExpenseMappingContext {
  fieldOptions: BitrixFieldOptions;
}

/** A Bitrix24 user / department field value as an ID; empty (or 0) → null. */
function userIdOrNull(value: BitrixFieldValue): string | null {
  const id = valuesOf(value)[0];
  return id && id !== '0' ? id : null;
}

/** "Deal / Project" values that link to a CRM record that is not a deal (e.g. a lead "L_33482"). */
function nonDealLinkOrNull(value: BitrixFieldValue, linkTypes: readonly string[]): string | null {
  const raw = valuesOf(value)[0];
  if (!raw || toLinkedDealId(value, linkTypes) !== null) return null;
  return /^L_\d+$/.test(raw) ? 'Linked to a lead (not a deal)' : 'Linked to a CRM record that is not a deal';
}

/**
 * The dashboard record of an "Expenses" smart-process record. That process has no "Expenses Bill
 * Amount" field (only "Expense Amount"), and only the Expenses Bill Amount counts, so these records
 * are listed but never in the Expense Total: shown without an amount ("—"), with why. The dates of
 * records without an Expense Date are their Created on day, labelled as such.
 */
export function mapBitrixExpenseRecord(item: BitrixExpenseItem, expense: Expense, context: ExpenseMappingContext): ExpenseRecord {
  return {
    ...expense,
    amount: 0,
    amountMissing: true,
    inExpenseTotal: false,
    notCountedReason: NOT_IN_TOTAL_LABELS.noAmount,
    dateSource: calendarDateOrNull(textOrNull(item[EXPENSE_FIELDS.expenseDate])) ? 'business' : 'created',
    note: null,
    employeeKey: expense.employeeId,
    departmentKey: expense.departmentId,
    responsibleId: userIdOrNull(item.assignedById),
    employeeText: null,
    departmentText: null,
    nonDealLink: nonDealLinkOrNull(item[EXPENSE_FIELDS.dealLink], context.fieldOptions.expenseDealLinkTypes),
  };
}

/** An "Expenses" smart-process record (its own fields). It has no "Essentials only" Category and is never counted. */

export function mapBitrixExpense(item: BitrixExpenseItem, context: ExpenseMappingContext): Expense {
  const { amount, currency } = parseMoney(item[EXPENSE_FIELDS.amount], 'INR');
  const dealId = toLinkedDealId(item[EXPENSE_FIELDS.dealLink], context.fieldOptions.expenseDealLinkTypes);

  return {
    id: `expenses-${item.id}`,
    source: 'expenses',
    sourceId: String(item.id),
    title: item.title?.trim() || `Expense #${item.id}`,
    amount,
    currency,
    categoryId: null,
    // Expense Date is a calendar day. Items without one fall back to their created date,
    // so they still count in the totals.
    date: calendarDateOrNull(textOrNull(item[EXPENSE_FIELDS.expenseDate])) ?? dateOrNull(item.createdTime) ?? new Date(0),
    // Employee is the record's own "Employee Name" (a user ID); empty stays empty (the Responsible
    // person is never used instead). Department is a department ID (company structure).
    employeeId: userIdOrNull(item[EXPENSE_FIELDS.employee]),
    departmentId: valuesOf(item[EXPENSE_FIELDS.department])[0] ?? null,
    siteName: siteNameOrNull(item[EXPENSE_FIELDS.siteName]),
    dealId,
  };
}

// ---------------------------------------------------------------------------
// "Essentials only" smart process (its Category field is the expense Category)
// ---------------------------------------------------------------------------

/** The Bitrix24 Category options, in Bitrix24 order, each with its counting rule (see ESSENTIALS_CATEGORY_RULES). */
export function mapEssentialsCategoryOptions(options: BitrixFieldOptions['essentialsCategories']): ExpenseCategoryOption[] {
  // Every expense Category configured in Bitrix24 follows the same rule (Expenses Bill Amount), also one
  // added later. Non-expense Categories (e.g. Payment Collection) are left out; the others keep their
  // Bitrix24 position as colour, so their colours do not change.
  return options
    .map((option, index) => ({
      id: option.id,
      label: option.label.trim() || `Category ${option.id}`,
      treatment: 'expense' as const,
      reason: null,
      colorIndex: index,
    }))
    .filter((option) => !NON_EXPENSE_CATEGORY_IDS.has(option.id));
}

/** Typed names are compared ignoring upper/lower case and extra spaces. */
function nameKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * name → ID, only for names that belong to exactly one record. A name shared by several
 * records (e.g. two Bitrix24 users with the same name) maps to nothing, so it is never guessed.
 */
function uniqueNameIndex<T>(records: readonly T[], nameOf: (record: T) => string, idOf: (record: T) => string): Map<string, string> {
  const ids = new Map<string, Set<string>>();
  for (const record of records) {
    const key = nameKey(nameOf(record));
    if (!key) continue;
    ids.set(key, (ids.get(key) ?? new Set<string>()).add(idOf(record)));
  }
  return new Map([...ids].filter(([, set]) => set.size === 1).map(([key, set]) => [key, [...set][0]]));
}

export interface EssentialsMappingContext {
  categoryOptions: readonly ExpenseCategoryOption[];
  failedStageIds: readonly string[];
  /** Text of the other "Essentials only" list fields (employee, departments). */
  listOptions: BitrixFieldOptions['essentials'];
  employees: readonly Employee[];
  departments: readonly Department[];
}

/**
 * Turns "Essentials only" records into expenses, by the same rule for every Category: a record
 * is counted only with its Expenses Bill Amount (no other amount field is ever used), its bill date,
 * and when it is not in the Bitrix24 failure stage. Every
 * record is accounted for in the summary (counted, or why not), so nothing is dropped silently.
 * Employee / Department are filled only from an exact, unambiguous name match.
 *
 * `records` holds EVERY record for display and filtering on the Expenses dashboard: the counted
 * expenses (same values as `expenses`) plus all others, each with why it is not in the Expense
 * Total. `expenses` is the accounting list and is exactly what it was before `records` existed.
 */
export function mapEssentialsItems(
  items: readonly BitrixEssentialsItem[],
  context: EssentialsMappingContext,
): {
  expenses: Expense[];
  records: ExpenseRecord[];
  summary: EssentialsCategorySummary[];
  typedValues: FinanceDataset['expenseTypedValues'];
} {
  const failed = new Set(context.failedStageIds);
  const optionsById = new Map(context.categoryOptions.map((option) => [option.id, option]));
  const userByName = uniqueNameIndex(context.employees, (employee) => employee.fullName, (employee) => employee.id);
  const departmentByName = uniqueNameIndex(context.departments, (department) => department.name, (department) => department.id);
  const usersPerName = new Map<string, number>();
  for (const employee of context.employees) usersPerName.set(nameKey(employee.fullName), (usersPerName.get(nameKey(employee.fullName)) ?? 0) + 1);
  const departmentNames = new Set(context.departments.map((department) => nameKey(department.name)));

  // Typed values not linked to one user / department: their own filter values, matched exactly.
  const typedEmployees = new Map<string, string>();
  const typedDepartments = new Map<string, string>();
  const typedLabel = {
    employee: (text: string) => {
      const users = usersPerName.get(nameKey(text)) ?? 0;
      return `${text} — typed name (${users === 0 ? 'no Bitrix24 user has this name' : `${users} Bitrix24 users have this name`})`;
    },
    // A typed department never shares its label with a company department.
    department: (text: string) => (departmentNames.has(nameKey(text)) ? `${text} (typed value)` : text),
  };
  /** Text, ID (exact unique match) and filter key of a typed list value; all null when empty. */
  const listValue = (
    text: string | null,
    kind: 'employee' | 'department',
  ): { id: string | null; key: string | null; text: string | null } => {
    if (text === null) return { id: null, key: null, text: null };
    const id = (kind === 'employee' ? userByName : departmentByName).get(nameKey(text)) ?? null;
    if (id !== null) return { id, key: id, text: null };
    const clean = text.trim().replace(/\s+/g, ' ');
    const key = typedValueKey(clean);
    const typed = kind === 'employee' ? typedEmployees : typedDepartments;
    if (!typed.has(key)) typed.set(key, typedLabel[kind](clean));
    return { id: null, key, text: clean };
  };
  const itemListValue = (item: BitrixEssentialsItem, field: `ufCrm${string}` | null, kind: 'employee' | 'department') =>
    listValue(field === null ? null : optionTextOrNull(item[field], context.listOptions[field]), kind);
  const matchListValue = (item: BitrixEssentialsItem, field: `ufCrm${string}` | null, kind: 'employee' | 'department') =>
    itemListValue(item, field, kind).id;

  // Every option of the employee / department lists is a Bitrix24 value, also before any record uses it.
  for (const rule of Object.values(ESSENTIALS_CATEGORY_RULES)) {
    for (const [field, kind] of [[rule.employeeField, 'employee'], [rule.departmentField, 'department']] as const) {
      if (field === null) continue;
      for (const text of Object.values(context.listOptions[field] ?? {})) if (text.trim()) listValue(text, kind);
    }
  }

  const summaries = new Map<string | null, EssentialsCategorySummary>(
    context.categoryOptions.map((option) => [option.id, emptySummary(option.id, option.label)]),
  );
  const expenses: Expense[] = [];
  const records: ExpenseRecord[] = [];

  for (const item of items) {
    const categoryId = valuesOf(item[ESSENTIALS_FIELDS.category])[0] ?? null;
    // Not an expense Category (e.g. Payment Collection): not part of the Expenses dashboard at all.
    if (categoryId !== null && NON_EXPENSE_CATEGORY_IDS.has(categoryId)) continue;
    const option = categoryId === null ? undefined : optionsById.get(categoryId);
    let summary = summaries.get(categoryId);
    if (!summary) {
      // No Category, or an option that no longer exists in Bitrix24: same rule as every Category.
      summary = emptySummary(categoryId, categoryId === null ? 'Category not filled in' : `Category ${categoryId}`);
      summaries.set(categoryId, summary);
    }
    summary.records += 1;

    const isFailed = !!item.stageId && failed.has(item.stageId);
    const dealIdNumber = Number(item[ESSENTIALS_FIELDS.dealLink] ?? 0);
    const createdOn = calendarDateOrNull(item.createdTime) ?? new Date(0);
    const title = item.title?.trim() || `${option?.label ?? 'Record'} #${item.id}`;
    /** A record shown on the Expenses dashboard; not in the Expense Total unless `reason` is null. */
    const record = (fields: {
      amount: { amount: number; currency: string };
      date: Date | null;
      employeeField: `ufCrm${string}` | null;
      departmentField: `ufCrm${string}` | null;
      siteField: `ufCrm${string}` | null;
      noteField?: `ufCrm${string}`;
      reason: string | null;
    }): ExpenseRecord => {
      const employee = itemListValue(item, fields.employeeField, 'employee');
      const department = itemListValue(item, fields.departmentField, 'department');
      return {
      id: `essentials-${item.id}`,
      source: 'essentials',
      sourceId: String(item.id),
      title,
      amount: fields.amount.amount > 0 ? fields.amount.amount : 0,
      currency: fields.amount.currency,
      categoryId: categoryId ?? EMPTY_CATEGORY_ID,
      date: fields.date ?? createdOn,
      employeeId: employee.id,
      departmentId: department.id,
      siteName: fields.siteField === null ? null : siteNameOrNull(item[fields.siteField]),
      dealId: dealIdNumber > 0 ? String(dealIdNumber) : null,
      inExpenseTotal: fields.reason === null,
      notCountedReason: fields.reason,
      amountMissing: !(fields.amount.amount > 0),
      dateSource: fields.date ? 'business' : 'created',
      note: fields.noteField ? optionTextOrNull(item[fields.noteField], context.listOptions[fields.noteField]) : null,
      employeeKey: employee.key,
      departmentKey: department.key,
      responsibleId: userIdOrNull(item.assignedById),
      employeeText: employee.text,
      departmentText: department.text,
      nonDealLink: null,
      };
    };

    // Same rule for every Category: only the Expenses Bill Amount counts, with its bill date.
    const rule = (categoryId !== null && option ? ESSENTIALS_CATEGORY_RULES[categoryId] : undefined) ?? DEFAULT_CATEGORY_RULE;
    const money = parseMoney(item[EXPENSES_BILL_AMOUNT_FIELD], 'INR');
    const date = firstFilledDate(item, rule.dateField);
    // A record without its bill date is placed by its Category's own date (display only), else Created on.
    const shownDate = date ?? (rule.displayDateFields ? firstFilledDate(item, rule.displayDateFields) : null);
    const shown = (reason: string | null) =>
      record({
        amount: money,
        date: shownDate,
        employeeField: rule.employeeField,
        departmentField: rule.departmentField,
        siteField: rule.siteField,
        noteField: rule.noteField,
        reason,
      });
    if (isFailed) {
      summary.failed += 1;
      records.push(shown(NOT_IN_TOTAL_LABELS.failed));
      continue;
    }
    if (!(money.amount > 0)) {
      summary.noAmount += 1;
      records.push(shown(NOT_IN_TOTAL_LABELS.noAmount));
      continue;
    }
    if (!date) {
      summary.noDate += 1;
      records.push(shown(NOT_IN_TOTAL_LABELS.noDate));
      continue;
    }

    const { amount, currency } = money;
    const employeeId = matchListValue(item, rule.employeeField, 'employee');
    const departmentId = matchListValue(item, rule.departmentField, 'department');
    const expense: Expense = {
      id: `essentials-${item.id}`,
      source: 'essentials',
      sourceId: String(item.id),
      title,
      amount,
      currency,
      categoryId: categoryId ?? EMPTY_CATEGORY_ID,
      date,
      employeeId,
      departmentId,
      siteName: rule.siteField === null ? null : siteNameOrNull(item[rule.siteField]),
      dealId: dealIdNumber > 0 ? String(dealIdNumber) : null,
    };
    expenses.push(expense);
    records.push(shown(null));
    summary.counted += 1;
    summary.countedAmount += amount;
    if (employeeId !== null) summary.employeeMatched += 1;
    if (departmentId !== null) summary.departmentMatched += 1;
  }

  const byLabel = (a: TypedFilterValue, b: TypedFilterValue) => a.label.localeCompare(b.label);
  return {
    expenses,
    records,
    summary: [...summaries.values()],
    typedValues: {
      employees: [...typedEmployees].map(([key, label]) => ({ key, label })).sort(byLabel),
      departments: [...typedDepartments].map(([key, label]) => ({ key, label })).sort(byLabel),
    },
  };
}

/** Filter value of a typed Employee / Department value (ignoring upper/lower case and extra spaces). */
export function typedValueKey(text: string): string {
  return `${TYPED_VALUE_PREFIX}${nameKey(text)}`;
}

type FieldPreference = `ufCrm${string}` | readonly `ufCrm${string}`[];

/** The first of the date fields (in order of preference) that is filled in. */
function firstFilledDate(item: BitrixEssentialsItem, fields: FieldPreference): Date | null {
  for (const field of typeof fields === 'string' ? [fields] : fields) {
    const date = calendarDateOrNull(textOrNull(item[field]));
    if (date) return date;
  }
  return null;
}

function emptySummary(categoryId: string | null, label: string): EssentialsCategorySummary {
  return {
    categoryId,
    label,
    treatment: 'expense',
    records: 0,
    counted: 0,
    countedAmount: 0,
    failed: 0,
    noAmount: 0,
    noDate: 0,
    employeeMatched: 0,
    departmentMatched: 0,
    infoAmount: null,
  };
}
