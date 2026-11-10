import { KpiCard } from '../../components/KpiCard';
import type { NetRevenueSummary, TrendPoint } from '../../types/finance';
import { calculateMarginPct } from '../../utils/netRevenue';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatSignedCurrency,
} from '../../utils/format';

interface NetRevenueKpisProps {
  summary: NetRevenueSummary;
  /** Used only for the small trend lines; no comparison % is shown. */
  trend: TrendPoint[];
}

export function NetRevenueKpis({ summary, trend }: NetRevenueKpisProps) {
  const marginTrend = trend
    .map((point) => calculateMarginPct(point.income, point.netRevenue))
    .filter((value): value is number => value !== null);

  const netNegative = summary.netRevenue < 0;
  const marginNegative = summary.marginPct !== null && summary.marginPct < 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        accent="income"
        label="Total income"
        value={formatCurrency(summary.income)}
        hint={`Instalments received · ${summary.dealCount} deal${summary.dealCount === 1 ? '' : 's'}`}
        trend={trend.map((point) => point.income)}
      />
      <KpiCard
        accent="expense"
        label="Total expenses"
        value={formatCurrency(summary.expenses)}
        hint={`Deals ${formatCurrencyCompact(summary.dealExpenses)} · General ${formatCurrencyCompact(summary.generalExpenses)}`}
        trend={trend.map((point) => point.expenses)}
      />
      <KpiCard
        accent="net"
        emphasis
        label="Net revenue"
        value={formatSignedCurrency(summary.netRevenue)}
        hint={netNegative ? 'Loss · income − expenses' : 'Income − expenses'}
        trend={trend.map((point) => point.netRevenue)}
      />
      <KpiCard
        accent="margin"
        label="Net margin"
        value={formatPercent(summary.marginPct)}
        valueClassName={marginNegative ? 'text-negative' : ''}
        hint={summary.marginPct === null ? 'No income in this period' : 'Net revenue ÷ income'}
        trend={marginTrend}
      />
    </div>
  );
}
