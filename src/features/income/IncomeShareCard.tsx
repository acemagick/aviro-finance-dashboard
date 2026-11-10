import { Card } from '../../components/Card';
import type { IncomeGroup } from '../../types/income';
import { formatCurrency, formatPercent } from '../../utils/format';

/** Theme-aware segment colours (full class names so Tailwind finds them). */
const SEGMENT_COLORS = ['bg-income', 'bg-net', 'bg-margin', 'bg-cat-manpower', 'bg-cat-transport', 'bg-cat-site'] as const;

interface IncomeShareCardProps {
  title: string;
  description: string;
  groups: IncomeGroup[];
}

/** Income split into groups (e.g. departments): stacked bar + list with amounts and shares. */
export function IncomeShareCard({ title, description, groups }: IncomeShareCardProps) {
  const visible = groups.filter((group) => group.income > 0);

  return (
    <Card title={title} description={description}>
      {groups.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle">No deals match these filters.</p>
      ) : (
        <>
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-line-subtle" role="img" aria-label={`${title}: share of income`}>
            {visible.map((group, index) => (
              <div
                key={group.id}
                className={`h-full ${SEGMENT_COLORS[index % SEGMENT_COLORS.length]}`}
                style={{ width: `${group.sharePct ?? 0}%` }}
                title={`${group.label}: ${formatPercent(group.sharePct)}`}
              />
            ))}
          </div>
          <ul className="mt-4 divide-y divide-line-subtle">
            {groups.map((group) => {
              const colorIndex = visible.findIndex((item) => item.id === group.id);
              return (
                <li key={group.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span
                    className={`size-2.5 shrink-0 rounded-sm ${colorIndex >= 0 ? SEGMENT_COLORS[colorIndex % SEGMENT_COLORS.length] : 'bg-line'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 text-ink">
                    {group.label}
                    <span className="ml-1.5 text-xs text-ink-subtle">
                      {group.dealCount} deal{group.dealCount === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="font-semibold text-ink tabular-nums">{formatCurrency(group.income)}</span>
                  <span className="w-12 text-right text-xs text-ink-subtle tabular-nums">{formatPercent(group.sharePct)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
