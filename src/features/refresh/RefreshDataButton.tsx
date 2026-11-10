import { RefreshIcon } from '../../components/icons';
import { useFinanceRefresh } from './refreshContext';

const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' });

/** Header button: reloads the latest Bitrix24 data for whichever dashboard is open. */
export function RefreshDataButton() {
  const { status, errorMessage, refreshedAt, refresh } = useFinanceRefresh();
  const refreshing = status === 'refreshing';

  let note: string | null = null;
  if (status === 'error') note = 'Refresh failed';
  else if (refreshedAt) note = `Updated ${timeFormat.format(refreshedAt)}`;

  return (
    <div className="flex items-center gap-2">
      <span
        role={status === 'error' ? 'alert' : 'status'}
        title={errorMessage ?? undefined}
        className={`hidden text-xs md:inline ${status === 'error' ? 'font-medium text-negative' : 'text-ink-subtle'}`}
      >
        {refreshing ? 'Fetching latest Bitrix24 data…' : note}
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={refreshing}
        aria-busy={refreshing}
        title={errorMessage ?? 'Reload the latest deals and expenses from Bitrix24'}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
      >
        <RefreshIcon className={`size-4 ${refreshing ? 'animate-spin' : ''} ${status === 'error' ? 'text-negative' : ''}`} />
        <span className="sr-only sm:not-sr-only">{refreshing ? 'Refreshing…' : 'Refresh data'}</span>
      </button>
    </div>
  );
}
