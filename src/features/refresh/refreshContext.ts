import { createContext, useContext } from 'react';

export type RefreshStatus = 'idle' | 'refreshing' | 'error';

export interface FinanceRefreshContextValue {
  /** Goes up by one after each successful refresh; dashboards reload when it changes. */
  version: number;
  status: RefreshStatus;
  /** Set when the last refresh failed. */
  errorMessage: string | null;
  /** When the last successful refresh finished (null until the first refresh). */
  refreshedAt: Date | null;
  /** Fetches fresh Bitrix24 data. Ignored while a refresh is already running. */
  refresh: () => void;
}

export const FinanceRefreshContext = createContext<FinanceRefreshContextValue | null>(null);

export function useFinanceRefresh(): FinanceRefreshContextValue {
  const value = useContext(FinanceRefreshContext);
  if (!value) throw new Error('useFinanceRefresh must be used inside <FinanceRefreshProvider>.');
  return value;
}
