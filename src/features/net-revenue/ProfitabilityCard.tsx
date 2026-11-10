import type { NetRevenueSummary } from '../../types/finance';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../../utils/format';

interface ProfitabilityCardProps {
  summary: NetRevenueSummary;
}

const SIZE = 176;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Ring showing what share of income is kept as net revenue. */
export function ProfitabilityCard({ summary }: ProfitabilityCardProps) {
  const margin = summary.marginPct;
  const filled = margin === null ? 0 : Math.min(Math.max(margin, 0), 100) / 100;
  const isLoss = margin !== null && margin < 0;

  let caption = 'net margin';
  if (margin === null) caption = 'no income in period';
  else if (isLoss) caption = 'net loss';

  const ringLabel =
    margin === null
      ? 'Net margin not available: no income in this period.'
      : `Net margin ${formatPercent(margin)}: ${isLoss ? 'expenses are higher than income' : `${formatPercent(margin)} of income is kept as net revenue`}.`;

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-hero bg-hero p-5 text-hero-ink">
      <h2 className="text-base font-semibold">Profitability</h2>
      <p className="mt-0.5 text-xs text-hero-muted">Share of income kept as net revenue</p>

      <div className="flex flex-1 items-center justify-center py-5">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-90" role="img" aria-label={ringLabel}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-hero-track" />
            {filled > 0 && (
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                className="stroke-net"
                strokeDasharray={`${filled * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
            <span className={`text-3xl font-bold tracking-tight tabular-nums ${isLoss ? 'text-negative' : ''}`}>
              {formatPercent(margin)}
            </span>
            <span className="mt-0.5 text-xs text-hero-muted">{caption}</span>
          </div>
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-hero-muted">Income</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(summary.income)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-hero-muted">Expenses</dt>
          <dd className="font-semibold text-expense tabular-nums">
            {summary.expenses > 0 ? `-${formatCurrency(summary.expenses)}` : formatCurrency(0)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-hero-track pt-2.5">
          <dt className="font-semibold">Net revenue</dt>
          <dd className={`font-bold tabular-nums ${summary.netRevenue < 0 ? 'text-negative' : 'text-net'}`}>
            {formatSignedCurrency(summary.netRevenue)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
