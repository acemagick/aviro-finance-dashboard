import { useCallback, useEffect, useState } from 'react';
import { currentFinanceDataset, loadFinanceDataset } from '../../services/financeDataService';
import { useFinanceRefresh } from '../refresh/refreshContext';
import type { FinanceDataset } from '../../types/finance';

export type FinanceDataState =
  | { status: 'loading' }
  | { status: 'success'; data: FinanceDataset }
  | { status: 'error'; message: string };

/**
 * Loads the finance dataset, with loading/error states and a retry.
 * Loads again after "Refresh data" (the refresh `version` changes); the current
 * figures stay on screen until the fresh ones arrive. A dataset already loaded by another
 * dashboard (and still current on the server) is shown at once, without downloading it again.
 */
export function useFinanceData() {
  const [state, setState] = useState<FinanceDataState>(() => {
    const data = currentFinanceDataset();
    return data ? { status: 'success', data } : { status: 'loading' };
  });
  const [attempt, setAttempt] = useState(0);
  const { version } = useFinanceRefresh();

  useEffect(() => {
    let cancelled = false;

    loadFinanceDataset().then(
      (data) => {
        // Same dataset as on screen: keep the state, so nothing is recalculated.
        if (!cancelled) setState((previous) => (previous.status === 'success' && previous.data === data ? previous : { status: 'success', data }));
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not load finance data.',
          });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt, version]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry };
}
