import { useCallback, useState } from 'react';

/**
 * Generic "edit, then Apply" filter state:
 * - `draft`   changes as the user edits the controls,
 * - `applied` is what the dashboard calculates with (updated on Apply),
 * - `reset`   returns both to the defaults immediately,
 * - `applyNow` changes some fields in both draft and applied at once
 *   (used by quick filters such as the category chips).
 */
export function useDraftFilters<T>(createDefaults: () => T, isEqual: (a: T, b: T) => boolean) {
  const [state, setState] = useState(() => {
    const defaults = createDefaults();
    return { draft: defaults, applied: defaults };
  });

  const updateDraft = useCallback((draft: T) => {
    setState((current) => ({ ...current, draft }));
  }, []);

  const apply = useCallback(() => {
    setState((current) => ({ ...current, applied: current.draft }));
  }, []);

  const reset = useCallback(() => {
    const defaults = createDefaults();
    setState({ draft: defaults, applied: defaults });
  }, [createDefaults]);

  const applyNow = useCallback((patch: Partial<T>) => {
    setState((current) => ({
      draft: { ...current.draft, ...patch },
      applied: { ...current.applied, ...patch },
    }));
  }, []);

  return {
    draft: state.draft,
    applied: state.applied,
    hasPendingChanges: !isEqual(state.draft, state.applied),
    updateDraft,
    apply,
    reset,
    applyNow,
  };
}
