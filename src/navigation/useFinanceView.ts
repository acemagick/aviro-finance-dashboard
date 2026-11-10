import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_FINANCE_VIEW, isAvailableView, type FinanceView } from './financeViews';

/**
 * Lightweight page switching without a routing library.
 * The current page is kept in the address, e.g. ".../#/income", so a refresh
 * or a bookmark opens the same page and the browser Back button works.
 */

function readViewFromHash(): FinanceView {
  if (typeof window === 'undefined') return DEFAULT_FINANCE_VIEW;
  const value = window.location.hash.replace(/^#\/?/, '');
  return isAvailableView(value) ? value : DEFAULT_FINANCE_VIEW;
}

export function useFinanceView() {
  const [view, setView] = useState<FinanceView>(readViewFromHash);

  // Keep in sync when the user presses Back/Forward or edits the address.
  useEffect(() => {
    const onHashChange = () => setView(readViewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: FinanceView) => {
    if (!isAvailableView(next)) return;
    setView(next);
    if (window.location.hash !== `#/${next}`) window.location.hash = `/${next}`;
    window.scrollTo({ top: 0 });
  }, []);

  return { view, navigate };
}
