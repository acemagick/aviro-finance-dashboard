import { Card } from '../../components/Card';
import { IncomeExpenseBar } from '../../components/IncomeExpenseBar';
import { LegendItem } from '../../components/LegendItem';
import { MarginBadge } from '../../components/MarginBadge';
import type { StageNetRevenue } from '../../types/finance';
import { formatCurrency, formatCurrencyCompact, formatSignedCurrencyCompact } from '../../utils/format';
import { calculateMarginPct } from '../../utils/netRevenue';

interface PipelineFinancialPerformanceProps {
  stages: StageNetRevenue[];
}

const headCell =
  'sticky top-0 z-10 border-b border-line bg-surface px-2 py-2 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase';

/** Stage-level analysis: income, expenses, net revenue and margin for each pipeline stage. */
export function PipelineFinancialPerformance({ stages }: PipelineFinancialPerformanceProps) {
  const scale = Math.max(0, ...stages.map((stage) => Math.max(stage.income, stage.expenses)));

  return (
    <Card
      title="Pipeline Financial Performance"
      description="Income, expenses and net revenue across the sales pipeline, stage by stage"
      actions={
        <div className="flex items-center gap-3">
          <LegendItem colorClass="bg-income" label="Income" />
          <LegendItem colorClass="bg-expense" label="Expenses" />
        </div>
      }
    >
      {stages.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-center text-sm text-ink-subtle">
          No deals match the selected filters.
        </p>
      ) : (
        <>
          {/* Scrolls inside the card when there are many stages. */}
          <div className="-mx-2 max-h-[22rem] overflow-auto">
            <table className="w-full min-w-[34rem] border-collapse text-xs">
              <thead>
                <tr className="text-left">
                  <th scope="col" className={headCell}>Stage</th>
                  <th scope="col" className={`${headCell} text-right`}>Deals</th>
                  <th scope="col" className={`${headCell} text-right`}>Income</th>
                  <th scope="col" className={`${headCell} text-right`}>Expenses</th>
                  <th scope="col" className={`${headCell} text-right`}>Net revenue</th>
                  <th scope="col" className={`${headCell} text-right`}>Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {stages.map((stage) => (
                  <tr key={stage.stageId} className="align-middle hover:bg-surface-muted/60">
                    <td className="px-2 py-2.5">
                      <p className="leading-snug font-medium text-ink">{stage.stageName}</p>
                      <IncomeExpenseBar income={stage.income} expenses={stage.expenses} scale={scale} className="mt-1.5 max-w-56" />
                    </td>
                    <td className="px-2 py-2.5 text-right text-ink-muted tabular-nums">{stage.dealCount}</td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap text-income tabular-nums" title={formatCurrency(stage.income)}>
                      {formatCurrencyCompact(stage.income)}
                    </td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap text-expense tabular-nums" title={formatCurrency(stage.expenses)}>
                      {formatCurrencyCompact(stage.expenses)}
                    </td>
                    <td
                      className={`px-2 py-2.5 text-right text-sm font-bold whitespace-nowrap tabular-nums ${stage.netRevenue < 0 ? 'text-negative' : 'text-ink'}`}
                      title={formatCurrency(stage.netRevenue)}
                    >
                      {formatSignedCurrencyCompact(stage.netRevenue)}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <MarginBadge value={calculateMarginPct(stage.income, stage.netRevenue)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-auto pt-3 text-[11px] text-ink-subtle">
            Amounts shown are based on deals matching the selected filters. Hover an amount to see the exact figure.
          </p>
        </>
      )}
    </Card>
  );
}
