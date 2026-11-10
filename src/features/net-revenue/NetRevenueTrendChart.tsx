import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../../components/Card';
import { LegendItem } from '../../components/LegendItem';
import { useChartPalette } from '../../theme/chartPalette';
import type { TrendGranularity, TrendPoint } from '../../types/finance';
import { GRANULARITY_LABELS } from '../../utils/dateRange';
import { formatCurrency, formatCurrencyCompact, formatSignedCurrency } from '../../utils/format';

interface NetRevenueTrendChartProps {
  data: TrendPoint[];
  granularity: TrendGranularity;
}

const SERIES_NAMES = { income: 'Income', expenses: 'Expenses', netRevenue: 'Net revenue' } as const;

export function NetRevenueTrendChart({ data, granularity }: NetRevenueTrendChartProps) {
  const palette = useChartPalette();
  const hasData = data.some((point) => point.income !== 0 || point.expenses !== 0);

  return (
    <Card
      title="Income vs expenses"
      description={`${GRANULARITY_LABELS[granularity][0].toUpperCase()}${GRANULARITY_LABELS[granularity].slice(1)} totals · instalments by received date, expenses by their own date`}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <LegendItem colorClass="bg-income" label="Income" />
          <LegendItem colorClass="bg-expense" label="Expenses" />
          <LegendItem colorClass="bg-net" label="Net revenue" />
        </div>
      }
    >
      {hasData ? (
        <div className="h-72 min-h-72 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.income} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={palette.income} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: palette.axis }}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(value: number) => formatCurrencyCompact(value)}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: palette.axis }}
                width={64}
              />
              <Tooltip
                cursor={{ fill: palette.grid, opacity: 0.5 }}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  color: 'var(--ink)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--ink)', fontWeight: 600, marginBottom: 4 }}
                formatter={(value, name) =>
                  name === SERIES_NAMES.netRevenue ? formatSignedCurrency(Number(value)) : formatCurrency(Number(value))
                }
              />
              <ReferenceLine y={0} stroke={palette.zeroLine} />
              <Bar dataKey="netRevenue" name={SERIES_NAMES.netRevenue} fill={palette.net} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Area
                type="monotone"
                dataKey="income"
                name={SERIES_NAMES.income}
                stroke={palette.income}
                strokeWidth={2}
                fill="url(#income-fill)"
                dot={{ r: 3, fill: palette.surface, strokeWidth: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name={SERIES_NAMES.expenses}
                stroke={palette.expense}
                strokeWidth={2}
                dot={{ r: 3, fill: palette.surface, strokeWidth: 2 }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="grid flex-1 place-items-center py-16 text-center text-sm text-ink-subtle">
          No deals or expenses in this period.
        </p>
      )}
    </Card>
  );
}
