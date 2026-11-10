import { EXCLUDE_LOST_DEALS_FROM_INCOME, INCOME_STATUS_GROUPS } from '../config/finance';
import type { Deal, FinanceDataset, NetRevenueFilters } from '../types/finance';
import type {
  IncomeDealRow,
  IncomeGroup,
  IncomeReport,
  InstallmentPaymentRow,
  InstallmentSummary,
  LeaderboardEntry,
} from '../types/income';
import { isInRange } from './dateRange';
import { dealIncome, isDealInScope, matchesDealFilters } from './netRevenue';

/*
 * INCOME RULES (Step 2). Income only — expenses are never used here.
 *
 * - Income of a deal = its Total Project Cost (Bitrix24 UF_CRM_6A71CB860E243). Empty → 0 in the totals and
 *   "—" in the deal table; the Deal Amount (OPPORTUNITY) is NOT used as a fallback.
 * - A deal matches when its Start Date is in the period and it matches the
 *   Department / Pipeline / Stage filters (same scope rule as Step 1).
 * - Overall Income  = SUM(Total Project Cost) of matching deals, for ALL responsible people.
 * - Person Income   = SUM(Total Project Cost) of matching deals where Responsible = selected person.
 * - Average Deal    = Person Income ÷ Person Deal Count.
 * - Share           = Person Income ÷ Overall Income × 100.
 * - Leaderboard     = every responsible person, ranked by income (Responsible filter ignored,
 *                     so you can see where the selected person stands).
 * - Department / Pipeline / Stage breakdowns and the deal table use the selected person's deals
 *   (or all matching deals when "All people" is selected).
 *
 * INSTALLMENTS (Bitrix24 installment fields 1–7, see DEAL_INSTALLMENT_FIELDS).
 * The Installment Payments section has its OWN applied Payment Period, matched against each
 * installment's "Payment Received Date" (never the deal's Start/Created/Close date).
 * The deals table's Received / Pending use the dashboard Period's end date as "to date", and its
 * Pending = max(0, Total Project Cost − Received to date) ("—" when Total Project Cost is empty).
 * The Installment Payments section below still uses the Deal Amount (dealIncome).
 * - Received          = installments whose received date is filled in (undated amounts are not received).
 * - Received in period= received installments whose received date is inside the Period (one row each).
 * - Received to date  = received installments with a received date up to the END of the Period.
 * - Pending           = max(0, Deal Amount − Received to date), flagged when Received to date > Deal Amount.
 * - Card totals cover INSTALLMENT DEALS: deals matching Project / Deal, Responsible / Department / Pipeline / Stage
 *   that have at least one installment recorded. The deals table rows use the same "to date" rule.
 */

function percent(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

/**
 * Income Dashboard tab: the income a deal contributes there is its Total Project Cost (`null` when empty).
 * Same lost-deal rule as dealIncome(); the shared dealIncome() itself stays on the Deal Amount.
 */
function dealProjectCost(deal: Deal): number | null {
  if (EXCLUDE_LOST_DEALS_FROM_INCOME && deal.status === 'lost') return 0;
  return deal.projectCost;
}

function sumIncome(deals: readonly Deal[]): number {
  return deals.reduce((total, deal) => total + (dealProjectCost(deal) ?? 0), 0);
}

/** Groups deals by a key and returns income per group, highest income first. */
function groupIncome(
  deals: readonly Deal[],
  keyOf: (deal: Deal) => string,
  labelOf: (key: string) => string,
  parentTotal: number,
): IncomeGroup[] {
  const groups = new Map<string, { income: number; dealCount: number }>();
  for (const deal of deals) {
    const key = keyOf(deal);
    const group = groups.get(key) ?? { income: 0, dealCount: 0 };
    group.income += dealProjectCost(deal) ?? 0;
    group.dealCount += 1;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      label: labelOf(id),
      income: group.income,
      dealCount: group.dealCount,
      sharePct: percent(group.income, parentTotal),
    }))
    .sort((a, b) => b.income - a.income || a.label.localeCompare(b.label));
}

const NO_DEPARTMENT = '__no-department__';

/** Σ installments received on or before `upTo` (installments without a received date never count). */
export function receivedInstallments(deal: Deal, upTo: Date): number {
  return deal.installments.reduce(
    (total, item) => total + (item.receivedDate && item.receivedDate <= upTo ? item.amount : 0),
    0,
  );
}

/**
 * Installment Payments section. `filters` = the Project / Deal, Responsible / Department / Pipeline / Stage filters
 * of the dashboard plus the section's OWN Payment Period as `dateRange`.
 */
export function buildInstallmentSummary(dataset: FinanceDataset, filters: NetRevenueFilters): InstallmentSummary {
  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee.fullName]));
  const personName = (id: string) => employees.get(id) ?? `User ${id}`;
  const periodEnd = filters.dateRange.end;
  const installmentDeals = dataset.deals.filter((deal) => deal.installments.length > 0 && matchesDealFilters(deal, filters));

  const payments: InstallmentPaymentRow[] = [];
  let receivedToDate = 0;
  let pending = 0;
  let receivedExceedsAmountCount = 0;
  let undatedAmount = 0;
  let undatedCount = 0;

  for (const deal of installmentDeals) {
    for (const item of deal.installments) {
      if (!item.receivedDate) {
        undatedAmount += item.amount;
        undatedCount += 1;
      } else if (isInRange(item.receivedDate, filters.dateRange)) {
        payments.push({
          id: `${deal.id}-${item.number}`,
          receivedDate: item.receivedDate,
          dealId: deal.id,
          dealTitle: deal.title,
          installmentNumber: item.number,
          responsibleName: personName(deal.responsibleId),
          amount: item.amount,
        });
      }
    }
    const received = receivedInstallments(deal, periodEnd);
    receivedToDate += received;
    pending += Math.max(0, dealIncome(deal) - received);
    if (received > dealIncome(deal)) receivedExceedsAmountCount += 1;
  }

  // Newest payment first (by Payment Received Date). Same day → deal name A–Z, then deal ID,
  // then the later installment first, so the order is always the same.
  payments.sort(
    (a, b) =>
      b.receivedDate.getTime() - a.receivedDate.getTime() ||
      a.dealTitle.localeCompare(b.dealTitle) ||
      Number(a.dealId) - Number(b.dealId) ||
      b.installmentNumber - a.installmentNumber,
  );

  return {
    payments,
    receivedInPeriod: payments.reduce((total, row) => total + row.amount, 0),
    payingDealCount: new Set(payments.map((row) => row.dealId)).size,
    installmentDealCount: installmentDeals.length,
    receivedToDate,
    pending,
    receivedExceedsAmountCount,
    undatedAmount,
    undatedCount,
  };
}

export function buildIncomeReport(dataset: FinanceDataset, filters: NetRevenueFilters): IncomeReport {
  const employees = new Map(dataset.employees.map((employee) => [employee.id, employee]));
  const departmentNames = new Map(dataset.departments.map((department) => [department.id, department.name]));
  const pipelineNames = new Map(dataset.pipelines.map((pipeline) => [pipeline.id, pipeline.name]));
  const stagesById = new Map(dataset.stages.map((stage) => [stage.id, stage]));

  const personName = (id: string) => employees.get(id)?.fullName ?? `User ${id}`;
  const departmentName = (id: string | null) =>
    id === null || id === NO_DEPARTMENT ? null : (departmentNames.get(id) ?? `Department ${id}`);
  const pipelineName = (id: string) => pipelineNames.get(id) ?? `Pipeline ${id}`;
  const stageName = (id: string) => stagesById.get(id)?.name ?? id;

  // All matching deals for everyone (Responsible Person filter ignored).
  const allPeopleFilters = { ...filters, responsibleId: null };
  const matchingDeals = dataset.deals.filter((deal) => isDealInScope(deal, allPeopleFilters));
  const overallIncome = sumIncome(matchingDeals);

  // Deals of the selected person (or everyone).
  const selectedId = filters.responsibleId;
  const scopeDeals = selectedId === null ? matchingDeals : matchingDeals.filter((deal) => deal.responsibleId === selectedId);
  const income = sumIncome(scopeDeals);
  const dealCount = scopeDeals.length;

  const selectedEmployee = selectedId === null ? undefined : employees.get(selectedId);
  const selectedPerson =
    selectedId === null
      ? null
      : {
          id: selectedId,
          name: personName(selectedId),
          departmentName: departmentName(selectedEmployee?.departmentId ?? null),
        };

  // Won / In progress / Lost (Lost only when it has deals).
  const byStatus = INCOME_STATUS_GROUPS.map((group) => {
    const deals = scopeDeals.filter((deal) => deal.status === group.status);
    const statusIncome = sumIncome(deals);
    return { ...group, income: statusIncome, dealCount: deals.length, sharePct: percent(statusIncome, income) };
  }).filter((group) => group.status !== 'lost' || group.dealCount > 0);

  // Leaderboard: everyone with matching deals.
  const leaderboard: LeaderboardEntry[] = groupIncome(
    matchingDeals,
    (deal) => deal.responsibleId,
    personName,
    overallIncome,
  ).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    departmentName: departmentName(employees.get(entry.id)?.departmentId ?? null),
  }));

  const byDepartment = groupIncome(
    scopeDeals,
    (deal) => deal.departmentId ?? NO_DEPARTMENT,
    (id) => departmentName(id) ?? 'No department',
    income,
  );
  const byPipeline = groupIncome(scopeDeals, (deal) => deal.pipelineId, pipelineName, income);
  const byStage = groupIncome(scopeDeals, (deal) => deal.stageId, stageName, income).sort(
    (a, b) => (stagesById.get(a.id)?.sort ?? Number.MAX_SAFE_INTEGER) - (stagesById.get(b.id)?.sort ?? Number.MAX_SAFE_INTEGER),
  );

  const deals: IncomeDealRow[] = scopeDeals
    .map((deal) => {
      const amount = dealProjectCost(deal);
      const received = receivedInstallments(deal, filters.dateRange.end);
      return {
        dealId: deal.id,
        title: deal.title,
        siteName: deal.siteName,
        responsibleId: deal.responsibleId,
        responsibleName: personName(deal.responsibleId),
        departmentName: departmentName(deal.departmentId),
        pipelineName: pipelineName(deal.pipelineId),
        stageName: stageName(deal.stageId),
        status: deal.status,
        startDate: deal.startDate,
        amount,
        received,
        pending: amount === null ? null : Math.max(0, amount - received),
        receivedExceedsAmount: amount !== null && received > amount,
      };
    })
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0) || a.title.localeCompare(b.title));

  return {
    selectedPerson,
    overallIncome,
    summary: {
      income,
      dealCount,
      averageDeal: dealCount > 0 ? income / dealCount : null,
      sharePct: percent(income, overallIncome),
      contributorCount: new Set(matchingDeals.map((deal) => deal.responsibleId)).size,
    },
    byStatus,
    leaderboard,
    byDepartment,
    byPipeline,
    byStage,
    deals,
    dealsTotal: deals.reduce((total, row) => total + (row.amount ?? 0), 0),
  };
}

/** "Minal Dhote" → "MD". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}
