import { useId, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { SearchIcon } from '../../components/icons';
import { PersonAvatar } from '../../components/PersonAvatar';
import type { LeaderboardEntry } from '../../types/income';
import { formatCurrency, formatPercent } from '../../utils/format';
import { matchesSearch, searchWords } from '../../utils/search';

interface IncomeLeaderboardProps {
  entries: LeaderboardEntry[];
  selectedId: string | null;
}

/**
 * Responsible people ranked by their total Project Cost (all other filters applied).
 * The search box only narrows the rows shown here: ranks, amounts, bars and shares are the
 * ones already calculated, and nothing else on the dashboard is affected.
 */
export function IncomeLeaderboard({ entries, selectedId }: IncomeLeaderboardProps) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  // Bars stay relative to the #1 person of the full leaderboard, whatever is searched.
  const top = entries[0]?.income ?? 0;

  const visible = useMemo(() => {
    const words = searchWords(query);
    return words.length === 0 ? entries : entries.filter((entry) => matchesSearch(entry.label, words));
  }, [entries, query]);

  return (
    <Card title="Leaderboard" description="Total Project Cost per responsible person">
      {entries.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-ink-subtle focus-within:ring-2 focus-within:ring-ink/15">
          <SearchIcon className="size-4 shrink-0 text-ink-subtle" />
          <label htmlFor={searchId} className="sr-only">
            Search responsible person
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search responsible person..."
            autoComplete="off"
            className="w-full min-w-0 bg-transparent py-2 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
      )}
      {entries.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle">No deals match these filters.</p>
      ) : visible.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle" role="status">
          No responsible person found.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {visible.map((entry) => {
            const isSelected = entry.id === selectedId;
            const width = top > 0 ? (entry.income / top) * 100 : 0;
            return (
              <li
                key={entry.id}
                aria-current={isSelected ? 'true' : undefined}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  isSelected ? 'border-income/40 bg-income/10' : 'border-transparent'
                }`}
              >
                <span className="w-6 shrink-0 text-xs font-semibold text-ink-subtle tabular-nums">
                  {String(entry.rank).padStart(2, '0')}
                </span>
                <PersonAvatar id={entry.id} name={entry.label} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm font-semibold break-words text-ink">
                      {entry.label}
                      {isSelected && <span className="sr-only"> (selected)</span>}
                    </p>
                    <p className="shrink-0 text-sm font-bold text-ink tabular-nums">{formatCurrency(entry.income)}</p>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-line-subtle" aria-hidden="true">
                    <div className="h-full rounded-full bg-income" style={{ width: `${Math.max(width, 2)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    {entry.dealCount} deal{entry.dealCount === 1 ? '' : 's'}
                    {entry.departmentName && ` · ${entry.departmentName}`} · {formatPercent(entry.sharePct)} of total
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
