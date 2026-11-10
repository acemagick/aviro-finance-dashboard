import type { DealStatus } from '../../types/finance';
import type { IncomeStatusSummary } from '../../types/income';
import { formatCurrency, formatPercent } from '../../utils/format';

const STATUS_COLORS: Record<DealStatus, string> = {
  won: 'bg-income',
  inProgress: 'bg-net',
  lost: 'bg-negative',
};

interface IncomeStatusCardProps {
  item: IncomeStatusSummary;
  /** e.g. "of Minal's income" or "of total income". */
  shareSuffix: string;
}

/** Income from Won / In progress deals, with a share bar. */
export function IncomeStatusCard({ item, shareSuffix }: IncomeStatusCardProps) {
  const width = item.sharePct === null ? 0 : Math.min(Math.max(item.sharePct, 0), 100);
  return (
    <section aria-label={`${item.label} income`} className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-ink-muted" title={item.description}>
        <span className={`size-2 rounded-full ${STATUS_COLORS[item.status]}`} aria-hidden="true" />
        {item.label}
      </p>
      <p className="mt-2 truncate text-2xl font-bold tracking-tight text-ink tabular-nums" title={formatCurrency(item.income)}>
        {formatCurrency(item.income)}
      </p>
      <div className="mt-3 h-1.5 w-full rounded-full bg-line-subtle" aria-hidden="true">
        {width > 0 && <div className={`h-full rounded-full ${STATUS_COLORS[item.status]}`} style={{ width: `${width}%` }} />}
      </div>
      <p className="mt-2 text-xs text-ink-subtle">
        {item.dealCount} deal{item.dealCount === 1 ? '' : 's'} · {formatPercent(item.sharePct)} {shareSuffix}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-subtle">{item.description}</p>
    </section>
  );
}
