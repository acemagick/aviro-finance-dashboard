import type {
  BitrixDeal,
  BitrixDealCategory,
  BitrixDealStage,
  BitrixDepartment,
  BitrixEssentialsItem,
  BitrixExpenseItem,
  BitrixFieldOptions,
  BitrixUser,
} from '../types/bitrix';

/**
 * A "data source" is anything that can provide raw Bitrix24 finance data.
 *
 * The dashboards use `bitrixFinanceDataSource` (live data through our server).
 * `mockFinanceDataSource` implements the same interface for offline testing only.
 */
export interface FinanceDataSource {
  getDeals(): Promise<BitrixDeal[]>;
  getUsers(): Promise<BitrixUser[]>;
  getDepartments(): Promise<BitrixDepartment[]>;
  getDealCategories(): Promise<BitrixDealCategory[]>;
  getDealStages(): Promise<BitrixDealStage[]>;
  /** Items of the Bitrix24 "Expenses" smart process. */
  getExpenses(): Promise<BitrixExpenseItem[]>;
  /** Items of the Bitrix24 "Essentials only" smart process (its Category field is the expense Category). */
  getEssentialsItems(): Promise<BitrixEssentialsItem[]>;
  /** Text for list-field option IDs. */
  getFieldOptions(): Promise<BitrixFieldOptions>;
}
