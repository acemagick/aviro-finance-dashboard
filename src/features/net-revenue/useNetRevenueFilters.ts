import { useCallback, useState } from 'react';
import type { NetRevenueFilters } from '../../types/finance';
import { createInitialFilterState, filtersEqual, type FilterState } from './filters';

/**
 * Filter state with an Apply step:
 * - `draft` changes as the user edits the controls,
 * - `applied` is what the dashboard calculates with, updated only on Apply,
 * - Reset returns both to the defaults immediately.
 */
export function useNetRevenueFilters() {
  const [state, setState] = useState<FilterState>(createInitialFilterState);

  const updateDraft = useCallback((draft: NetRevenueFilters) => {
    setState((current) => ({ ...current, draft }));
  }, []);

  const apply = useCallback(() => {
    setState((current) => ({ ...current, applied: current.draft }));
  }, []);

  const reset = useCallback(() => {
    setState(createInitialFilterState());
  }, []);

  return {
    draft: state.draft,
    applied: state.applied,
    hasPendingChanges: !filtersEqual(state.draft, state.applied),
    updateDraft,
    apply,
    reset,
  };
}
