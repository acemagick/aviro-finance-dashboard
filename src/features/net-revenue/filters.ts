import { endOfDay, startOfDay } from 'date-fns';
import type { SelectOption } from '../../components/SelectField';
import { GENERAL_EXPENSES_DEAL_ID } from '../../types/expenses';
import type { FinanceDataset, NetRevenueFilters, PeriodSelection, PeriodType } from '../../types/finance';
import { getPeriodRange } from '../../utils/dateRange';

/**
 * Pure helpers for the filter bar. Each returns a NEW filters object,
 * so React state is never changed in place.
 */

export const DEFAULT_PERIOD = 'year' as const;

/** Default period for every dashboard: the current year. */
export function createDefaultPeriodSelection(): PeriodSelection {
  const today = startOfDay(new Date());
  return {
    period: DEFAULT_PERIOD,
    anchorDate: today,
    dateRange: getPeriodRange(DEFAULT_PERIOD, today),
  };
}

/** Starting filters: the current year, everything else "All". */
export function createDefaultFilters(): NetRevenueFilters {
  return {
    ...createDefaultPeriodSelection(),
    dealId: null,
    pipelineId: null,
    stageId: null,
    departmentId: null,
    responsibleId: null,
  };
}

/** What the controls show (draft) vs. what the dashboard uses (applied). */
export interface FilterState {
  draft: NetRevenueFilters;
  applied: NetRevenueFilters;
}

export function createInitialFilterState(): FilterState {
  const filters = createDefaultFilters();
  return { draft: filters, applied: filters };
}

export function withPeriod<T extends PeriodSelection>(filters: T, period: PeriodType): T {
  // Switching to Custom keeps the current dates as a starting point.
  if (period === 'custom') return { ...filters, period };
  return { ...filters, period, dateRange: getPeriodRange(period, filters.anchorDate) };
}

/** Selects a specific day/month/quarter/year: `date` is any date inside it. */
export function withAnchorDate<T extends PeriodSelection>(filters: T, date: Date): T {
  if (filters.period === 'custom') return filters;
  const anchorDate = startOfDay(date);
  return { ...filters, anchorDate, dateRange: getPeriodRange(filters.period, anchorDate) };
}

/** Years offered in the Month / Quarter / Year pickers: every year with deals, plus one either side. */
export function buildYearOptions(dataset: FinanceDataset, selectedYear: number): number[] {
  const years = dataset.deals.map((deal) => deal.startDate.getFullYear()).filter(Number.isFinite);
  const first = Math.min(selectedYear, ...years) - 1;
  const last = Math.max(selectedYear, ...years) + 1;
  return Array.from({ length: last - first + 1 }, (_, index) => last - index);
}

/** Custom start date. If it moves past the end date, the end date moves too. */
export function withCustomStart<T extends PeriodSelection>(filters: T, date: Date): T {
  const start = startOfDay(date);
  const end = filters.dateRange.end < start ? endOfDay(date) : filters.dateRange.end;
  return { ...filters, dateRange: { start, end } };
}

/** Custom end date. If it moves before the start date, the start date moves too. */
export function withCustomEnd<T extends PeriodSelection>(filters: T, date: Date): T {
  const end = endOfDay(date);
  const start = filters.dateRange.start > end ? startOfDay(date) : filters.dateRange.start;
  return { ...filters, dateRange: { start, end } };
}

/** Changing department clears the person if they are not in that department. */
export function withDepartment(
  filters: NetRevenueFilters,
  departmentId: string | null,
  dataset: FinanceDataset,
): NetRevenueFilters {
  const person = dataset.employees.find((employee) => employee.id === filters.responsibleId);
  const keepPerson = departmentId === null || (person !== undefined && person.departmentId === departmentId);
  return { ...filters, departmentId, responsibleId: keepPerson ? filters.responsibleId : null };
}

/** Changing pipeline clears the stage if it belongs to another pipeline. */
export function withPipeline(
  filters: NetRevenueFilters,
  pipelineId: string | null,
  dataset: FinanceDataset,
): NetRevenueFilters {
  const stage = dataset.stages.find((item) => item.id === filters.stageId);
  const keepStage = pipelineId === null || (stage !== undefined && stage.pipelineId === pipelineId);
  return { ...filters, pipelineId, stageId: keepStage ? filters.stageId : null };
}

/** Same period type and exact dates. */
export function periodEqual(a: PeriodSelection, b: PeriodSelection): boolean {
  return (
    a.period === b.period &&
    a.dateRange.start.getTime() === b.dateRange.start.getTime() &&
    a.dateRange.end.getTime() === b.dateRange.end.getTime()
  );
}

export function filtersEqual(a: NetRevenueFilters, b: NetRevenueFilters): boolean {
  return (
    periodEqual(a, b) &&
    a.dealId === b.dealId &&
    a.pipelineId === b.pipelineId &&
    a.stageId === b.stageId &&
    a.departmentId === b.departmentId &&
    a.responsibleId === b.responsibleId
  );
}

// ---------------------------------------------------------------------------
// Dropdown options
// ---------------------------------------------------------------------------

/** Value used by dropdowns for "no filter". */
export const ALL_VALUE = '';

export function toFilterValue(value: string): string | null {
  return value === ALL_VALUE ? null : value;
}

const byLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label);

/**
 * Project / Deal options: "All projects", then every Bitrix24 deal as "Title (#ID)", A–Z.
 * `includeGeneral` adds "General (not linked to a deal)" (Expenses only: income always has a deal).
 */
export function buildDealOptions(dataset: FinanceDataset, { includeGeneral = false } = {}): SelectOption[] {
  return [
    { value: ALL_VALUE, label: 'All projects' },
    ...(includeGeneral ? [{ value: GENERAL_EXPENSES_DEAL_ID, label: 'General (not linked to a deal)' }] : []),
    ...dataset.deals.map((deal) => ({ value: deal.id, label: `${deal.title} (#${deal.id})` })).sort(byLabel),
  ];
}

export function buildPipelineOptions(dataset: FinanceDataset): SelectOption[] {
  return [
    { value: ALL_VALUE, label: 'All pipelines' },
    ...dataset.pipelines.map((pipeline) => ({ value: pipeline.id, label: pipeline.name })),
  ];
}

/** Stages in pipeline order, narrowed to the chosen pipeline. */
export function buildStageOptions(dataset: FinanceDataset, pipelineId: string | null): SelectOption[] {
  return [
    { value: ALL_VALUE, label: 'All stages' },
    ...dataset.stages
      .filter((stage) => pipelineId === null || stage.pipelineId === pipelineId)
      .map((stage) => ({ value: stage.id, label: stage.name })),
  ];
}

/** Only departments that actually own deals. */
export function buildDepartmentOptions(dataset: FinanceDataset): SelectOption[] {
  const used = new Set(dataset.deals.map((deal) => deal.departmentId));
  return [
    { value: ALL_VALUE, label: 'All departments' },
    ...dataset.departments
      .filter((department) => used.has(department.id))
      .map((department) => ({ value: department.id, label: department.name }))
      .sort(byLabel),
  ];
}

/** Only people responsible for deals, narrowed to the chosen department. */
export function buildResponsibleOptions(
  dataset: FinanceDataset,
  departmentId: string | null,
): SelectOption[] {
  const responsibleIds = new Set(dataset.deals.map((deal) => deal.responsibleId));
  return [
    { value: ALL_VALUE, label: 'All people' },
    ...dataset.employees
      .filter((employee) => responsibleIds.has(employee.id))
      .filter((employee) => departmentId === null || employee.departmentId === departmentId)
      .map((employee) => ({ value: employee.id, label: employee.fullName }))
      .sort(byLabel),
  ];
}
