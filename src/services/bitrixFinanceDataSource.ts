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
import type { FinanceDataSource } from './financeDataSource';

/**
 * Live Bitrix24 data, loaded through our own server (server/index.js).
 * The browser never sees the Bitrix24 webhook — only these /api/* endpoints.
 */
/**
 * Per endpoint: until when the server serves the same cached data ("X-Cache-Expires-In").
 * A missing header counts as "now", so the data is never reused longer than the server keeps it.
 */
const serverCacheExpiry = new Map<string, number>();

/** The earliest moment any of the last loaded endpoints stops being the server's current data. */
export function serverCacheValidUntil(): number {
  return serverCacheExpiry.size === 0 ? 0 : Math.min(...serverCacheExpiry.values());
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const expiresIn = Number(response.headers.get('X-Cache-Expires-In'));
  serverCacheExpiry.set(path, Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 0));

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `API request failed: ${response.status}`);
  }

  return response.json();
}

export const bitrixFinanceDataSource: FinanceDataSource = {
  async getDeals(): Promise<BitrixDeal[]> {
    return (await api<{ deals: BitrixDeal[] }>('/api/real-deals')).deals;
  },

  async getUsers(): Promise<BitrixUser[]> {
    return (await api<{ users: BitrixUser[] }>('/api/users')).users;
  },

  async getDepartments(): Promise<BitrixDepartment[]> {
    return (await api<{ departments: BitrixDepartment[] }>('/api/departments')).departments;
  },

  async getDealCategories(): Promise<BitrixDealCategory[]> {
    return (await api<{ categories: BitrixDealCategory[] }>('/api/deal-categories')).categories;
  },

  async getDealStages(): Promise<BitrixDealStage[]> {
    return (await api<{ stages: BitrixDealStage[] }>('/api/deal-stages')).stages;
  },

  async getExpenses(): Promise<BitrixExpenseItem[]> {
    return (await api<{ items: BitrixExpenseItem[] }>('/api/real-expenses')).items;
  },

  async getEssentialsItems(): Promise<BitrixEssentialsItem[]> {
    return (await api<{ items: BitrixEssentialsItem[] }>('/api/essentials-items')).items;
  },

  async getFieldOptions(): Promise<BitrixFieldOptions> {
    return api<BitrixFieldOptions>('/api/field-options');
  },
};
