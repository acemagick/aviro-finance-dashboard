import { Card } from '../../components/Card';
import type { IncomeGroup } from '../../types/income';
import { formatCurrency, formatCurrencyCompact, formatPercent } from '../../utils/format';

interface IncomeByStageCardProps {
  title: string;
  stages: IncomeGroup[];
}

/** Income per pipeline stage, in pipeline order. */
export function IncomeByStageCard({ title, stages }: IncomeByStageCardProps) {
  const top = Math.max(0, ...stages.map((stage) => stage.income));

  return (
    <Card title={title} description="Total Project Cost by current pipeline stage, in pipeline order">
      {stages.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle">No deals match these filters.</p>
      ) : (
        <ul className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
          {stages.map((stage) => (
            <li key={stage.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <p className="min-w-0 text-ink">
                  {stage.label}
                  <span className="ml-1.5 text-xs text-ink-subtle">
                    {stage.dealCount} deal{stage.dealCount === 1 ? '' : 's'}
                  </span>
                </p>
                <p className="shrink-0 tabular-nums">
                  <span className="font-semibold text-ink" title={formatCurrency(stage.income)}>
                    {formatCurrencyCompact(stage.income)}
                  </span>
                  <span className="ml-2 inline-block w-11 text-right text-xs text-ink-subtle">{formatPercent(stage.sharePct)}</span>
                </p>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-line-subtle" aria-hidden="true">
                <div className="h-full rounded-full bg-income" style={{ width: `${top > 0 ? Math.max((stage.income / top) * 100, 2) : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
