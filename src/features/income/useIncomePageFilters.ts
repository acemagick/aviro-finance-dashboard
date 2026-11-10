import { useCallback, useMemo, useState } from 'react';
import type { NetRevenueFilters, PeriodSelection } from '../../types/finance';
import { createDefaultFilters, filtersEqual } from '../net-revenue/filters';

/** The two tabs of the Income page. */
export type IncomeView = 'income' | 'installments';

type DealFilters = Omit<NetRevenueFilters, keyof PeriodSelection>;

interface Pair<T> {
  draft: T;
  applied: T;
}

interface IncomePageFilterState {
  /** Responsible / Department / Pipeline / Stage — shared by both tabs. */
  shared: Pair<DealFilters>;
  /** The date — each tab keeps its own (Income: deal Start Date; Installments: Payment Received Date). */
  periods: Record<IncomeView, Pair<PeriodSelection>>;
}

function split(filters: NetRevenueFilters): { period: PeriodSelection; deal: DealFilters } {
  const { period, anchorDate, dateRange, ...deal } = filters;
  return { period: { period, anchorDate, dateRange }, deal };
}

function createInitialState(): IncomePageFilterState {
  const { period, deal } = split(createDefaultFilters());
  return {
    shared: { draft: deal, applied: deal },
    periods: { income: { draft: period, applied: period }, installments: { draft: period, applied: period } },
  };
}

/**
 * One filter bar for the Income page's two tabs, with an Apply step:
 * - the bar edits the active tab's date plus the shared deal filters (draft),
 * - Apply makes them the applied filters of the active tab (the deal filters apply to both tabs),
 * - Reset returns both tabs to the defaults.
 */
export function useIncomePageFilters(view: IncomeView) {
  const [state, setState] = useState(createInitialState);

  const draft = useMemo<NetRevenueFilters>(
    () => ({ ...state.shared.draft, ...state.periods[view].draft }),
    [state.shared.draft, state.periods, view],
  );
  const applied = useMemo<NetRevenueFilters>(
    () => ({ ...state.shared.applied, ...state.periods[view].applied }),
    [state.shared.applied, state.periods, view],
  );

  const updateDraft = useCallback(
    (filters: NetRevenueFilters) => {
      const { period, deal } = split(filters);
      setState((current) => ({
        shared: { ...current.shared, draft: deal },
        periods: { ...current.periods, [view]: { ...current.periods[view], draft: period } },
      }));
    },
    [view],
  );

  const apply = useCallback(() => {
    setState((current) => ({
      shared: { ...current.shared, applied: current.shared.draft },
      periods: { ...current.periods, [view]: { ...current.periods[view], applied: current.periods[view].draft } },
    }));
  }, [view]);

  const reset = useCallback(() => setState(createInitialState()), []);

  return { draft, applied, hasPendingChanges: !filtersEqual(draft, applied), updateDraft, apply, reset };
}
