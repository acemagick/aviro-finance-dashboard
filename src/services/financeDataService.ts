import type { FinanceDataset } from '../types/finance';
import {
  mapBitrixDeal,
  mapBitrixDealCategory,
  mapBitrixDealStage,
  mapBitrixDepartment,
  mapBitrixExpense,
  mapBitrixUser,
  mapBitrixExpenseRecord,
  mapEssentialsCategoryOptions,
  mapEssentialsItems,
} from './bitrixMappers';
import type { FinanceDataSource } from './financeDataSource';
import { bitrixFinanceDataSource, serverCacheValidUntil } from './bitrixFinanceDataSource';

/**
 * The single entry point the UI uses to load finance data.
 *
 * Defaults to live Bitrix24 data. Components never import mock data directly.
 */
export async function getFinanceDataset(
  source: FinanceDataSource = bitrixFinanceDataSource,
): Promise<FinanceDataset> {
  const [rawDeals, rawUsers, rawDepartments, rawCategories, rawStages, rawExpenses, rawEssentials, fieldOptions] =
    await Promise.all([
      source.getDeals(),
      source.getUsers(),
      source.getDepartments(),
      source.getDealCategories(),
      source.getDealStages(),
      source.getExpenses(),
      source.getEssentialsItems(),
      source.getFieldOptions(),
    ]);

  const employees = rawUsers.map(mapBitrixUser);
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const deals = rawDeals.map((deal) => mapBitrixDeal(deal, employeesById, fieldOptions.deal));
  const pipelines = rawCategories.map(mapBitrixDealCategory);
  // Stages are listed pipeline by pipeline (in Bitrix24 pipeline order), then in stage order.
  const pipelineOrder = new Map(pipelines.map((pipeline, index) => [pipeline.id, index]));
  const pipelineIndex = (pipelineId: string) => pipelineOrder.get(pipelineId) ?? pipelines.length;
  // Expense transactions: every "Expenses" record + the "Essentials only" records its Category rules count.
  const expenseCategoryOptions = mapEssentialsCategoryOptions(fieldOptions.essentialsCategories);
  const departments = rawDepartments.map(mapBitrixDepartment);
  const essentials = mapEssentialsItems(rawEssentials, {
    categoryOptions: expenseCategoryOptions,
    failedStageIds: fieldOptions.essentialsFailedStageIds,
    listOptions: fieldOptions.essentials,
    employees,
    departments,
  });

  const processExpenses = rawExpenses.map((item) => mapBitrixExpense(item, { fieldOptions }));
  const processRecords = rawExpenses.map((item, index) => mapBitrixExpenseRecord(item, processExpenses[index], { fieldOptions }));

  return {
    deals,
    // Only records with an Expenses Bill Amount count; the "Expenses" smart process has no such field.
    expenses: essentials.expenses,
    // What the Expenses dashboard shows and filters: every record, counted or not (each says why).
    expenseRecords: [...processRecords, ...essentials.records],
    expenseTypedValues: essentials.typedValues,
    employees,
    departments,
    expenseCategoryOptions,
    essentialsSummary: essentials.summary,
    pipelines,
    stages: rawStages
      .map(mapBitrixDealStage)
      .sort((a, b) => pipelineIndex(a.pipelineId) - pipelineIndex(b.pipelineId) || a.sort - b.sort),
  };
}

/**
 * The load in progress, shared so that several callers asking at the same time
 * (two components, React StrictMode's double effect, or the Refresh button and
 * the dashboard) trigger one download. Cleared as soon as it settles.
 */
let pendingLoad: Promise<FinanceDataset> | null = null;

/**
 * The last loaded dataset, reused when switching between Net Revenue, Income and Expenses —
 * only until the server's cache of that data expires (`validUntil`), i.e. exactly as long as the
 * server would answer with the same data anyway. "Refresh data" drops it (refreshServerData).
 */
let loaded: { data: FinanceDataset; validUntil: number } | null = null;

/** The loaded dataset when it is still the server's current data, else null. */
export function currentFinanceDataset(): FinanceDataset | null {
  return loaded !== null && Date.now() < loaded.validUntil ? loaded.data : null;
}

export function loadFinanceDataset(options: { startNew?: boolean } = {}): Promise<FinanceDataset> {
  const current = options.startNew ? null : currentFinanceDataset();
  if (current !== null && pendingLoad === null) return Promise.resolve(current);
  // After a refresh, never join a load that started before the server had fresh data.
  if (options.startNew || !pendingLoad) {
    const load: Promise<FinanceDataset> = getFinanceDataset()
      .then((data) => {
        // A load replaced by a newer one (Refresh data) is never kept.
        if (pendingLoad === load) loaded = { data, validUntil: serverCacheValidUntil() };
        return data;
      })
      .finally(() => {
        if (pendingLoad === load) pendingLoad = null;
      });
    pendingLoad = load;
  }
  return pendingLoad;
}

/**
 * Asks the server to drop its 5-minute cache and fetch fresh data from Bitrix24.
 * Resolves once the server has the fresh data.
 */
export async function refreshServerData(): Promise<void> {
  // From now on nothing loaded before the refresh is reused.
  loaded = null;
  const response = await fetch('/api/refresh', { method: 'POST' });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Refresh failed: ${response.status}`);
  }
}
