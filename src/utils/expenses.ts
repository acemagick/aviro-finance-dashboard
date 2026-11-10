import { EXPENSE_AMOUNT_RANGES, NOT_IN_TOTAL_LABELS } from '../config/finance';
import type { Employee, EssentialsCategorySummary, Expense, ExpenseRecord, FinanceDataset } from '../types/finance';
import {
  EMPTY_CATEGORY_ID,
  GENERAL_EXPENSES_DEAL_ID,
  NO_CATEGORY_ID,
  type ExpenseDealSummary,
  type ExpenseNotInTotalCategory,
  type ExpenseFilters,
  type ExpenseItemRow,
  type ExpenseReport,
  type ExpenseTrendPoint,
} from '../types/expenses';
import { bucketKey, bucketLabel, bucketStart, granularityForPeriod, isInRange, listBuckets } from './dateRange';
import { categoryDisplay, EMPTY_CATEGORY_LABEL, totalsByCategory } from './expenseCategories';
import { instalmentIncome } from './netRevenue';

/*
 * EXPENSE RULES. Calculated only from the "Essentials only" records of ANY Category that have an
 * Expenses Bill Amount and bill date and are not in the Failed stage (config/finance.ts). Only the
 * Expenses Bill Amount is used; records of the "Expenses" smart process (which has no such field)
 * are listed but never counted. Each record is one entry.
 *
 * - An entry matches when its own Date is in the period and it matches the
 *   Project/Deal, Category, Amount, Employee, Department and Site filters.
 *   Site names match ignoring upper/lower case and extra spaces (they are typed by hand).
 * - The table shows EVERY matching record of `dataset.expenseRecords`, also those not in the
 *   Expense Total (no Expenses Bill Amount, no bill date, failed stage), each marked with why. A record without an amount matches only "Any amount".
 * - Total Expenses and every other summary figure use only the matching records that are in the
 *   Expense Total (the same ones as `dataset.expenses`); the others are reported separately.
 * - Expense entries  = COUNT of every matching record (the Expense items rows), split into those
 *                    in the Expense Total (`entryCount`) and not (`notInTotal`).
 * - "How expenses are counted" is built from the matching records too (`countingSummary`).
 * - Total Expenses   = SUM(amount) of matching entries in the Expense Total.
 * - Category total   = SUM(amount) of matching entries in that category.
 * - Category %       = category total ÷ total × 100 ("—" when total is 0).
 * - Selected deal (whole life of the deal):
 *     Income   = SUM of the deal's installments received (installments with a received date;
 *                the Deal Amount / OPPORTUNITY is not used)
 *     Expenses = SUM of ALL expenses linked to the deal (any date, any category)
 *     Net      = Income − Expenses
 *     Spent %  = Expenses ÷ Income × 100 ("—" when the income is 0)
 */

function percent(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

/** Site names are typed by hand, so "GE Chakan" and "GE chakan" are the same site. */
export function siteKey(siteName: string): string {
  return siteName.trim().replace(/\s+/g, ' ').toLowerCase();
}

function sumAmounts(expenses: readonly Expense[]): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

export function isInAmountRange(amount: number, rangeId: ExpenseFilters['amountRange']): boolean {
  const range = EXPENSE_AMOUNT_RANGES.find((item) => item.id === rangeId);
  if (!range) return true;
  if (range.min !== null && amount < range.min) return false;
  if (range.max !== null && amount >= range.max) return false;
  return true;
}

/**
 * Project / Deal rule, shared by the filter and by the deal-scoped filter options:
 * `dealId` null = any; GENERAL_EXPENSES_DEAL_ID = not linked to an existing deal; otherwise expense.dealId === deal.id.
 * An expense pointing to an unknown (e.g. deleted) deal counts as a general expense.
 */
export function expenseInDeal(expense: Expense, dealId: string | null, knownDealIds: ReadonlySet<string>): boolean {
  if (dealId === null) return true;
  const linkedDealId = expense.dealId !== null && knownDealIds.has(expense.dealId) ? expense.dealId : null;
  return dealId === GENERAL_EXPENSES_DEAL_ID ? linkedDealId === null : linkedDealId === dealId;
}

/**
 * Employee option labels by user ID. Different users who share a name are never merged: each
 * keeps its own ID and gets it in the label, e.g. "Kiran Aher — User #68".
 */
export function employeeLabels(employees: readonly Employee[]): Map<string, string> {
  const key = (name: string) => siteKey(name);
  const counts = new Map<string, number>();
  for (const employee of employees) counts.set(key(employee.fullName), (counts.get(key(employee.fullName)) ?? 0) + 1);
  return new Map(
    employees.map((employee) => [
      employee.id,
      (counts.get(key(employee.fullName)) ?? 0) > 1 ? `${employee.fullName.trim()} — User #${employee.id}` : employee.fullName,
    ]),
  );
}

/**
 * Employee is the record-level Responsible person (`responsibleId`, a Bitrix24 user ID).
 * Department / Site rules use the record's own value only: the Bitrix24 ID, or the typed value
 * matched exactly (`departmentKey`). Empty fields match only "All".
 */
export function expenseMatchesFilters(expense: ExpenseRecord, filters: ExpenseFilters, knownDealIds: ReadonlySet<string>): boolean {
  // A record without an amount has no amount to place in a range.
  const amountMissing = expense.amountMissing;
  return (
    isInRange(expense.date, filters.dateRange) &&
    expenseInDeal(expense, filters.dealId, knownDealIds) &&
    (filters.category === null ||
      (filters.category === NO_CATEGORY_ID ? expense.categoryId === null : expense.categoryId === filters.category)) &&
    (filters.employeeId === null || expense.responsibleId === filters.employeeId) &&
    (filters.departmentId === null || expense.departmentKey === filters.departmentId) &&
    (filters.siteName === null || (expense.siteName !== null && siteKey(expense.siteName) === siteKey(filters.siteName))) &&
    (amountMissing ? filters.amountRange === 'any' : isInAmountRange(expense.amount, filters.amountRange))
  );
}

/**
 * "How expenses are counted" per Category for the given "Essentials only" records — the same
 * figures as the load-time summary of `mapEssentialsItems` (FinanceDataset.essentialsSummary),
 * which it equals when given every record. Uses each record's own result of the counting rules
 * (`inExpenseTotal`, `notCountedReason`); the rules themselves are not applied again here.
 * Every Category of `allCategories` (the global summary) has a row, in the same order, also
 * when no given record has it.
 */
export function countingSummaryFromRecords(
  records: readonly ExpenseRecord[],
  allCategories: readonly EssentialsCategorySummary[],
): EssentialsCategorySummary[] {
  const empty = (categoryId: string | null, label: string, treatment: EssentialsCategorySummary['treatment']): EssentialsCategorySummary => ({
    categoryId,
    label,
    treatment,
    records: 0,
    counted: 0,
    countedAmount: 0,
    failed: 0,
    noAmount: 0,
    noDate: 0,
    employeeMatched: 0,
    departmentMatched: 0,
    infoAmount: null,
  });
  const rows = new Map(allCategories.map((row) => [row.categoryId, empty(row.categoryId, row.label, row.treatment)]));
  for (const record of records) {
    if (record.source !== 'essentials') continue;
    // The summary's "Category not filled in" row has no Category ID.
    const categoryId = record.categoryId === EMPTY_CATEGORY_ID ? null : record.categoryId;
    let row = rows.get(categoryId);
    if (!row) {
      row = empty(categoryId, categoryId === null ? EMPTY_CATEGORY_LABEL : `Category ${categoryId}`, 'unresolved');
      rows.set(categoryId, row);
    }
    row.records += 1;
    if (record.inExpenseTotal) {
      row.counted += 1;
      row.countedAmount += record.amount;
      if (record.employeeId !== null) row.employeeMatched += 1;
      if (record.departmentId !== null) row.departmentMatched += 1;
      continue;
    }
    if (record.notCountedReason === NOT_IN_TOTAL_LABELS.failed) row.failed += 1;
    else if (record.notCountedReason === NOT_IN_TOTAL_LABELS.noAmount) row.noAmount += 1;
    else if (record.notCountedReason === NOT_IN_TOTAL_LABELS.noDate) row.noDate += 1;
  }
  return [...rows.values()];
}

export function buildExpenseReport(dataset: FinanceDataset, filters: ExpenseFilters): ExpenseReport {
  const dealsById = new Map(dataset.deals.map((deal) => [deal.id, deal]));
  const knownDealIds = new Set(dealsById.keys());
  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee.fullName.trim().replace(/\s+/g, ' ')]));
  const departments = new Map(dataset.departments.map((department) => [department.id, department.name]));
  const pipelines = new Map(dataset.pipelines.map((pipeline) => [pipeline.id, pipeline.name]));
  const stages = new Map(dataset.stages.map((stage) => [stage.id, stage.name]));

  const shown = dataset.expenseRecords.filter((record) => expenseMatchesFilters(record, filters, knownDealIds));
  // Accounting: only the records in the Expense Total.
  const matching = shown.filter((record) => record.inExpenseTotal);
  const notCounted = shown.filter((record) => !record.inExpenseTotal);
  const total = sumAmounts(matching);
  const linked = matching.filter((expense) => expense.dealId !== null && knownDealIds.has(expense.dealId));
  const dealLinkedTotal = sumAmounts(linked);

  // ---- By Category (Bitrix24 "Essentials only" Category options) ----
  const byCategory = totalsByCategory(matching, dataset.expenseCategoryOptions, total);
  const categoryOptionsById = new Map(dataset.expenseCategoryOptions.map((option) => [option.id, option]));
  const categoriesUsed = byCategory.filter((item) => item.amount > 0).length;

  // ---- Entries over the selected period (for the small bar chart) ----
  const granularity = granularityForPeriod(filters.period, filters.dateRange);
  const points = new Map<string, ExpenseTrendPoint>();
  for (const start of listBuckets(filters.dateRange, granularity)) {
    const key = bucketKey(start);
    points.set(key, { key, label: bucketLabel(start, granularity), entryCount: 0, recordCount: 0, amount: 0 });
  }
  for (const expense of matching) {
    const point = points.get(bucketKey(bucketStart(expense.date, granularity)));
    if (point) {
      point.entryCount += 1;
      point.amount += expense.amount;
    }
  }
  for (const record of shown) {
    const point = points.get(bucketKey(bucketStart(record.date, granularity)));
    if (point) point.recordCount += 1;
  }

  // ---- Matching records NOT in the Expense Total, per Category (shown, never added up) ----
  const notInTotalByCategory = new Map<string | null, ExpenseNotInTotalCategory>();
  for (const record of notCounted) {
    let entry = notInTotalByCategory.get(record.categoryId);
    if (!entry) {
      const option = record.categoryId === null ? undefined : categoryOptionsById.get(record.categoryId);
      entry = {
        categoryId: record.categoryId,
        ...categoryDisplay(record.categoryId, categoryOptionsById),
        treatment: option?.treatment ?? null,
        count: 0,
        amount: 0,
        reasons: [],
      };
      notInTotalByCategory.set(record.categoryId, entry);
    }
    entry.count += 1;
    entry.amount += record.amount;
    if (record.notCountedReason && !entry.reasons.includes(record.notCountedReason)) entry.reasons.push(record.notCountedReason);
  }

  // ---- Table rows, newest first ----
  const rows: ExpenseItemRow[] = shown
    .map((expense) => {
      const deal = expense.dealId === null ? undefined : dealsById.get(expense.dealId);
      const category = categoryDisplay(expense.categoryId, categoryOptionsById);
      return {
        id: expense.id,
        date: expense.date,
        title: expense.title,
        source: expense.source,
        sourceId: expense.sourceId,
        categoryId: expense.categoryId,
        categoryLabel: category.label,
        colorIndex: category.colorIndex,
        // Employee is the record-level Responsible person, the same value the Employee filter uses.
        employeeId: expense.responsibleId,
        employeeName: expense.responsibleId !== null ? (employees.get(expense.responsibleId) ?? `User #${expense.responsibleId}`) : null,
        // The record's own value: department name, or the typed value exactly as in Bitrix24.
        departmentName:
          expense.departmentId !== null
            ? (departments.get(expense.departmentId) ?? `Department #${expense.departmentId}`)
            : expense.departmentText,
        siteName: expense.siteName,
        dealId: deal?.id ?? null,
        dealName: deal?.title ?? null,
        dealLinkNote: deal
          ? null
          : expense.dealId !== null
            ? `Deal #${expense.dealId} (no longer in Bitrix24)`
            : expense.nonDealLink,
        // Deal value from Bitrix24 OPPORTUNITY (not instalments); none for general / deleted deals.
        dealAmount: deal ? deal.amount : null,
        amount: expense.amount,
        amountMissing: expense.amountMissing,
        inExpenseTotal: expense.inExpenseTotal,
        notCountedReason: expense.notCountedReason,
        dateSource: expense.dateSource,
        note: expense.note,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime() || Number(b.inExpenseTotal) - Number(a.inExpenseTotal) || b.amount - a.amount);

  // ---- Selected deal summary ----
  let dealSummary: ExpenseDealSummary | null = null;
  const selectedDeal = filters.dealId === null ? undefined : dealsById.get(filters.dealId);
  if (selectedDeal) {
    const allLinked = dataset.expenses.filter((expense) => expense.dealId === selectedDeal.id);
    const income = instalmentIncome(selectedDeal, null);
    const undated = selectedDeal.installments.filter((item) => item.receivedDate === null);
    const linkedExpenses = sumAmounts(allLinked);
    const netAmount = income - linkedExpenses;
    dealSummary = {
      dealId: selectedDeal.id,
      title: selectedDeal.title,
      siteName: selectedDeal.siteName,
      responsibleName: dataset.employees.find((employee) => employee.id === selectedDeal.responsibleId)?.fullName ?? `User ${selectedDeal.responsibleId}`,
      pipelineName: pipelines.get(selectedDeal.pipelineId) ?? `Pipeline ${selectedDeal.pipelineId}`,
      stageName: stages.get(selectedDeal.stageId) ?? selectedDeal.stageId,
      status: selectedDeal.status,
      income,
      instalmentCount: selectedDeal.installments.length,
      undatedInstalments: { count: undated.length, amount: undated.reduce((total, item) => total + item.amount, 0) },
      linkedExpenses,
      linkedEntryCount: allLinked.length,
      netAmount,
      spentPct: percent(linkedExpenses, income),
      marginPct: percent(netAmount, income),
    };
  }

  return {
    total,
    entryCount: matching.length,
    recordCount: shown.length,
    dealLinkedTotal,
    generalTotal: total - dealLinkedTotal,
    linkedDealCount: new Set(linked.map((expense) => expense.dealId)).size,
    byCategory,
    categoriesUsed,
    topCategory: byCategory[0] && byCategory[0].amount > 0 ? byCategory[0] : null,
    trend: [...points.values()],
    granularity,
    rows,
    notInTotal: { count: notCounted.length, amount: sumAmounts(notCounted) },
    notInTotalByCategory: [...notInTotalByCategory.values()].sort((a, b) => b.amount - a.amount || b.count - a.count),
    countingSummary: countingSummaryFromRecords(shown, dataset.essentialsSummary),
    expensesRecordCount: shown.filter((record) => record.source === 'expenses').length,
    dealSummary,
  };
}
