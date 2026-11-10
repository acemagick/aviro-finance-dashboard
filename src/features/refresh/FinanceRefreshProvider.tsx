import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadFinanceDataset, refreshServerData } from '../../services/financeDataService';
import { FinanceRefreshContext, type FinanceRefreshContextValue, type RefreshStatus } from './refreshContext';

/**
 * "Refresh data" for all three dashboards.
 *
 * 1. Asks the server to clear its 5-minute cache and fetch fresh Bitrix24 data.
 * 2. Starts loading the fresh dataset and bumps `version`, so the dashboard on
 *    screen reloads (it joins the same download, so nothing is fetched twice).
 * The figures on screen stay visible until the fresh ones arrive.
 */
export function FinanceRefreshProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<RefreshStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  // A ref (not state) so a double click cannot start two refreshes before React re-renders.
  const inProgress = useRef(false);

  const refresh = useCallback(() => {
    if (inProgress.current) return;
    inProgress.current = true;
    setStatus('refreshing');
    setErrorMessage(null);

    (async () => {
      try {
        await refreshServerData();
        const load = loadFinanceDataset({ startNew: true });
        setVersion((value) => value + 1);
        await load;
        setRefreshedAt(new Date());
        setStatus('idle');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Could not refresh data from Bitrix24.');
        setStatus('error');
      } finally {
        inProgress.current = false;
      }
    })();
  }, []);

  const value = useMemo<FinanceRefreshContextValue>(
    () => ({ version, status, errorMessage, refreshedAt, refresh }),
    [version, status, errorMessage, refreshedAt, refresh],
  );

  return <FinanceRefreshContext.Provider value={value}>{children}</FinanceRefreshContext.Provider>;
}
