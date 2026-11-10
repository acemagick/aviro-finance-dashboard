import { EXPENSE_FIELDS } from '../config/finance';
import { MOCK_BITRIX_DEALS } from '../data/mock/bitrixDeals';
import {
  MOCK_BITRIX_DEAL_CATEGORIES,
  MOCK_BITRIX_DEAL_STAGES,
  MOCK_BITRIX_DEPARTMENTS,
  MOCK_BITRIX_USERS,
} from '../data/mock/bitrixDirectory';
import { MOCK_EXPENSES } from '../data/mock/expenses';
import type { BitrixExpenseItem, BitrixFieldOptions } from '../types/bitrix';
import type { FinanceDataSource } from './financeDataSource';

/**
 * OFFLINE TESTING ONLY — not used by any dashboard.
 * The dashboards load live Bitrix24 data through `bitrixFinanceDataSource`.
 */

/** Small delay so loading states behave like a real network call. */
const MOCK_LATENCY_MS = 300;

function respond<T>(data: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(data)), MOCK_LATENCY_MS);
  });
}

/** The demo expenses in the raw smart-process shape the real API returns. */
const MOCK_EXPENSE_ITEMS: BitrixExpenseItem[] = MOCK_EXPENSES.map((expense) => ({
  id: Number(expense.id.replace(/\D/g, '')) || 0,
  title: expense.title,
  assignedById: Number(expense.employeeId) || null,
  createdTime: expense.date.toISOString(),
  [EXPENSE_FIELDS.amount]: `${expense.amount}|${expense.currency}`,
  [EXPENSE_FIELDS.category]: expense.category,
  [EXPENSE_FIELDS.dealLink]: expense.dealId === null ? null : `D_${expense.dealId}`,
  [EXPENSE_FIELDS.employee]: expense.employeeId,
  [EXPENSE_FIELDS.department]: expense.departmentId,
  [EXPENSE_FIELDS.siteName]: expense.siteName,
  [EXPENSE_FIELDS.expenseDate]: expense.date.toISOString(),
}));

const MOCK_FIELD_OPTIONS: BitrixFieldOptions = {
  deal: {},
  expense: {},
  expenseDealLinkTypes: ['DEAL'],
  essentialsCategories: [],
  essentialsFailedStageIds: [],
  essentials: {},
};

export const mockFinanceDataSource: FinanceDataSource = {
  getDeals: () => respond(MOCK_BITRIX_DEALS),
  getUsers: () => respond(MOCK_BITRIX_USERS),
  getDepartments: () => respond(MOCK_BITRIX_DEPARTMENTS),
  getDealCategories: () => respond(MOCK_BITRIX_DEAL_CATEGORIES),
  getDealStages: () => respond(MOCK_BITRIX_DEAL_STAGES),
  getExpenses: () => respond(MOCK_EXPENSE_ITEMS),
  getEssentialsItems: () => respond([]),
  getFieldOptions: () => respond(MOCK_FIELD_OPTIONS),
};
