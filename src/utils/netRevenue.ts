import { EXCLUDE_LOST_DEALS_FROM_INCOME, INCOME_DATE_FIELD } from '../config/finance';
import type {
  BreakdownRow,
  CategoryExpense,
  DateRange,
  Deal,
  DealNetRevenueRow,
  Expense,
  FinanceDataset,
  NetRevenueFilters,
  NetRevenueReport,
  StageNetRevenue,
  TrendPoint,
} from '../types/finance';
import {
  bucketKey,
  bucketLabel,
  bucketStart,
  granularityForPeriod,
  isInRange,
  listBuckets,
} from './dateRange';
import { totalsByCategory } from './expenseCategories';

/*
 * NET REVENUE RULES (all in one place so they are easy to review):
 *
 * Confirmed with AVIRO: income = instalments only, expenses by their own date.
 *
 * 1. Income of a deal = the Bitrix24 installments (1st–7th) whose "Payment Received"
 *    date is in the selected period. Installments without a received date are not
 *    income. The Deal Amount (OPPORTUNITY) is NOT used here.
 * 2. Deal expenses = expenses linked to a deal whose own date is in the period.
 * 3. Deals shown = deals that match the Project / Deal, Responsible / Department / Pipeline / Stage
 *    filters AND received an installment or have a linked expense in the period.
 *    Total Income = sum of their income.
 * 4. General expenses = expenses NOT linked to any deal (rent, software, ...)
 *    whose own date is in the period. They are included only when no deal
 *    filter is active, because they cannot be assigned to a specific deal.
 * 5. Total Expenses = deal expenses + general expenses (each expense counted once).
 * 6. Net Revenue = Total Income − Total Expenses.
 * 7. Margin % = Net Revenue ÷ Total Income × 100 ("—" when income is 0).
 *
 * (The Income dashboard keeps its own rule — Deal Amount by Start Date — through
 * isDealInScope / dealIncome below.)
 *
 * Every section of the dashboard is built from the same deal rows and
 * expense lists below, so all totals always agree with each other.
 */

export const NO_DEPARTMENT_ID = '__no-department__';
export const GENERAL_COSTS_ID = '__general-costs__';

export function hasDealLevelFilter(filters: NetRevenueFilters): boolean {
  return (
    filters.dealId !== null ||
    filters.pipelineId !== null ||
    filters.stageId !== null ||
    filters.departmentId !== null ||
    filters.responsibleId !== null
  );
}

/** The date that places a deal (and its income) in a period. */
export function dealIncomeDate(deal: Deal): Date {
  return deal[INCOME_DATE_FIELD];
}

/** Project / Deal, Responsible / Department / Pipeline / Stage filters (no date). */
export function matchesDealFilters(deal: Deal, filters: NetRevenueFilters): boolean {
  return (
    (filters.dealId === null || deal.id === filters.dealId) &&
    (filters.pipelineId === null || deal.pipelineId === filters.pipelineId) &&
    (filters.stageId === null || deal.stageId === filters.stageId) &&
    (filters.departmentId === null || deal.departmentId === filters.departmentId) &&
    (filters.responsibleId === null || deal.responsibleId === filters.responsibleId)
  );
}

/** Income dashboard scope: Start Date in the period + the deal filters. */
export function isDealInScope(deal: Deal, filters: NetRevenueFilters): boolean {
  return isInRange(dealIncomeDate(deal), filters.dateRange) && matchesDealFilters(deal, filters);
}

/**
 * Net Revenue income of a deal: its installments received within `range`
 * (all received installments when `range` is null). Undated installments are not received.
 */
export function instalmentIncome(deal: Deal, range: DateRange | null): number {
  return deal.installments.reduce(
    (total, item) =>
      total + (item.receivedDate !== null && (range === null || isInRange(item.receivedDate, range)) ? item.amount : 0),
    0,
  );
}

/** Income dashboard: the income a deal contributes there is its Deal Amount. */
export function dealIncome(deal: Deal): number {
  if (EXCLUDE_LOST_DEALS_FROM_INCOME && deal.status === 'lost') return 0;
  return deal.amount;
}

export function calculateMarginPct(income: number, netRevenue: number): number | null {
  return income > 0 ? (netRevenue / income) * 100 : null;
}

function sumAmounts(expenses: readonly Expense[]): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

/** Adds income/expenses into a keyed group, creating the group on first use. */
function addToGroup(
  groups: Map<string, BreakdownRow>,
  id: string,
  label: string,
  amounts: { income: number; expenses: number; deals: number },
  isGeneral = false,
): void {
  const group = groups.get(id) ?? {
    id,
    label,
    dealCount: 0,
    income: 0,
    expenses: 0,
    netRevenue: 0,
    marginPct: null,
    isGeneral,
  };
  group.dealCount += amounts.deals;
  group.income += amounts.income;
  group.expenses += amounts.expenses;
  groups.set(id, group);
}

function finishGroups(groups: Map<string, BreakdownRow>): BreakdownRow[] {
  return [...groups.values()]
    .map((group) => {
      const netRevenue = group.income - group.expenses;
      return { ...group, netRevenue, marginPct: calculateMarginPct(group.income, netRevenue) };
    })
    .sort((a, b) => Number(a.isGeneral) - Number(b.isGeneral) || b.netRevenue - a.netRevenue);
}

export function buildNetRevenueReport(
  dataset: FinanceDataset,
  filters: NetRevenueFilters,
): NetRevenueReport {
  const allDealIds = new Set(dataset.deals.map((deal) => deal.id));
  const inPeriod = (date: Date) => isInRange(date, filters.dateRange);
  const filteredDeals = dataset.deals.filter((deal) => matchesDealFilters(deal, filters));
  const filteredDealIds = new Set(filteredDeals.map((deal) => deal.id));

  // Rule 2: costs of the filtered deals, by the expense's own date.
  const dealExpenseItems = dataset.expenses.filter(
    (expense) => expense.dealId !== null && filteredDealIds.has(expense.dealId) && inPeriod(expense.date),
  );

  // Rule 4: general costs. An expense pointing to an unknown deal is treated as general.
  const isGeneral = (expense: Expense) => expense.dealId === null || !allDealIds.has(expense.dealId);
  const generalExpenseItems = hasDealLevelFilter(filters)
    ? []
    : dataset.expenses.filter((expense) => isGeneral(expense) && inPeriod(expense.date));

  const expensesByDeal = new Map<string, number>();
  for (const expense of dealExpenseItems) {
    if (expense.dealId === null) continue;
    expensesByDeal.set(expense.dealId, (expensesByDeal.get(expense.dealId) ?? 0) + expense.amount);
  }

  // Rules 1 and 3: deals with income (installments received) or expenses in the period.
  const incomeByDeal = new Map(filteredDeals.map((deal) => [deal.id, instalmentIncome(deal, filters.dateRange)]));
  const dealsInScope = filteredDeals.filter(
    (deal) => (incomeByDeal.get(deal.id) ?? 0) > 0 || expensesByDeal.has(deal.id),
  );

  const pipelineNames = new Map(dataset.pipelines.map((pipeline) => [pipeline.id, pipeline.name]));
  const departmentNames = new Map(dataset.departments.map((department) => [department.id, department.name]));
  const stagesById = new Map(dataset.stages.map((stage) => [stage.id, stage]));
  const employeeNames = new Map(dataset.employees.map((employee) => [employee.id, employee.fullName]));

  // ---- Deal-wise rows ----
  const dealRows: DealNetRevenueRow[] = dealsInScope.map((deal) => {
    const income = incomeByDeal.get(deal.id) ?? 0;
    const expenses = expensesByDeal.get(deal.id) ?? 0;
    const netRevenue = income - expenses;
    return {
      dealId: deal.id,
      title: deal.title,
      siteName: deal.siteName,
      projectType: deal.projectType,
      plantCapacityKw: deal.plantCapacityKw,
      startDate: deal.startDate,
      pipelineId: deal.pipelineId,
      pipelineName: pipelineNames.get(deal.pipelineId) ?? `Pipeline ${deal.pipelineId}`,
      departmentId: deal.departmentId,
      stageId: deal.stageId,
      stageName: stagesById.get(deal.stageId)?.name ?? deal.stageId,
      responsibleName: employeeNames.get(deal.responsibleId) ?? `User ${deal.responsibleId}`,
      income,
      expenses,
      netRevenue,
      marginPct: calculateMarginPct(income, netRevenue),
    };
  });
  dealRows.sort((a, b) => b.netRevenue - a.netRevenue);

  // ---- Summary (rules 3, 5, 6, 7) ----
  const income = dealRows.reduce((total, row) => total + row.income, 0);
  const dealExpenses = sumAmounts(dealExpenseItems);
  const generalExpenses = sumAmounts(generalExpenseItems);
  const expenses = dealExpenses + generalExpenses;
  const netRevenue = income - expenses;

  // ---- Trend: income by installment received date, every expense by its own date ----
  const granularity = granularityForPeriod(filters.period, filters.dateRange);
  const points = new Map<string, TrendPoint>();
  for (const start of listBuckets(filters.dateRange, granularity)) {
    const key = bucketKey(start);
    points.set(key, { key, label: bucketLabel(start, granularity), income: 0, expenses: 0, netRevenue: 0 });
  }
  const pointFor = (date: Date) => points.get(bucketKey(bucketStart(date, granularity)));

  for (const deal of dealsInScope) {
    for (const item of deal.installments) {
      if (item.receivedDate === null || !inPeriod(item.receivedDate)) continue;
      const point = pointFor(item.receivedDate);
      if (point) point.income += item.amount;
    }
  }
  for (const expense of [...dealExpenseItems, ...generalExpenseItems]) {
    const point = pointFor(expense.date);
    if (point) point.expenses += expense.amount;
  }
  const trend = [...points.values()].map((point) => ({
    ...point,
    netRevenue: point.income - point.expenses,
  }));

  // ---- By stage (stage-level analysis; general costs have no stage) ----
  const stageTotals = new Map<string, StageNetRevenue>();
  for (const row of dealRows) {
    const current = stageTotals.get(row.stageId) ?? {
      stageId: row.stageId,
      stageName: row.stageName,
      sort: stagesById.get(row.stageId)?.sort ?? Number.MAX_SAFE_INTEGER,
      dealCount: 0,
      income: 0,
      expenses: 0,
      netRevenue: 0,
    };
    current.dealCount += 1;
    current.income += row.income;
    current.expenses += row.expenses;
    current.netRevenue += row.netRevenue;
    stageTotals.set(row.stageId, current);
  }
  const byStage = [...stageTotals.values()].sort((a, b) => a.sort - b.sort);

  // ---- By department: deals by their department; general costs by the expense's department ----
  const departments = new Map<string, BreakdownRow>();
  const departmentLabel = (id: string | null) =>
    id === null ? 'No department' : (departmentNames.get(id) ?? `Department ${id}`);
  for (const row of dealRows) {
    addToGroup(departments, row.departmentId ?? NO_DEPARTMENT_ID, departmentLabel(row.departmentId), {
      income: row.income,
      expenses: row.expenses,
      deals: 1,
    });
  }
  for (const expense of generalExpenseItems) {
    addToGroup(departments, expense.departmentId ?? NO_DEPARTMENT_ID, departmentLabel(expense.departmentId), {
      income: 0,
      expenses: expense.amount,
      deals: 0,
    });
  }

  // ---- By pipeline: deals by pipeline; general costs shown on their own row ----
  const pipelines = new Map<string, BreakdownRow>();
  for (const row of dealRows) {
    addToGroup(pipelines, row.pipelineId, row.pipelineName, { income: row.income, expenses: row.expenses, deals: 1 });
  }
  if (generalExpenses > 0) {
    addToGroup(
      pipelines,
      GENERAL_COSTS_ID,
      'General costs (not linked to a deal)',
      { income: 0, expenses: generalExpenses, deals: 0 },
      true,
    );
  }

  // ---- Expenses by Category (same split as the Expenses dashboard) ----
  const allScopedExpenses = [...dealExpenseItems, ...generalExpenseItems];
  const byCategory: CategoryExpense[] = totalsByCategory(allScopedExpenses, dataset.expenseCategoryOptions, expenses).map(
    ({ categoryId, label, colorIndex, amount, sharePct }) => ({ categoryId, label, colorIndex, amount, sharePct }),
  );

  return {
    summary: {
      income,
      expenses,
      dealExpenses,
      generalExpenses,
      netRevenue,
      marginPct: calculateMarginPct(income, netRevenue),
      dealCount: dealRows.length,
    },
    dealRows,
    trend,
    granularity,
    byStage,
    byDepartment: finishGroups(departments),
    byPipeline: finishGroups(pipelines),
    byCategory,
  };
}
