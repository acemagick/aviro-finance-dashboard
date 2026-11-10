import { useMemo } from 'react';
import { formatDateRange } from '../../utils/dateRange';
import { buildNetRevenueReport } from '../../utils/netRevenue';
import { DealNetRevenueTable } from './DealNetRevenueTable';
import { ExpensesByCategoryCard } from './ExpensesByCategoryCard';
import { FinancialBreakdownCard } from './FinancialBreakdownCard';
import { NetRevenueFilterBar } from './NetRevenueFilterBar';
import { NetRevenueKpis } from './NetRevenueKpis';
import { NetRevenueTrendChart } from './NetRevenueTrendChart';
import { PipelineFinancialPerformance } from './PipelineFinancialPerformance';
import { ProfitabilityCard } from './ProfitabilityCard';
import { useFinanceData } from './useFinanceData';
import { useNetRevenueFilters } from './useNetRevenueFilters';

/** Step 1: the Net Revenue / P&L dashboard. Every section uses the same applied filters. */
export function NetRevenueDashboard() {
  const { state, retry } = useFinanceData();
  const { draft, applied, hasPendingChanges, updateDraft, apply, reset } = useNetRevenueFilters();

  // `data` only exists once loading has succeeded; null while loading or after an error.
  const data = state.status === 'success' ? state.data : null;

  const report = useMemo(
    () => (data ? buildNetRevenueReport(data, applied) : null),
    [data, applied],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Net Revenue · Profit &amp; Loss</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="font-semibold text-ink">{formatDateRange(applied.dateRange)}</span>
            <span className="text-ink-subtle"> · income = instalments received · expenses by their own date</span>
          </p>
        </div>
        <span className="self-start rounded-full border border-warn-line bg-warn-bg px-3 py-1 text-xs font-semibold text-warn-ink sm:self-auto">
          Live Bitrix24 data
        </span>
      </div>

      {state.status === 'loading' && (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center text-sm text-ink-muted" role="status">
          Loading finance data…
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-2xl border border-negative/40 bg-negative/10 p-6 text-sm text-ink" role="alert">
          <p className="font-semibold text-negative">Could not load finance data.</p>
          <p className="mt-1 text-ink-muted">{state.message}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 rounded-lg bg-accent px-4 py-2 font-semibold text-on-accent hover:opacity-90"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === 'success' && report && (
        <>
          <NetRevenueFilterBar
            dataset={state.data}
            filters={draft}
            hasPendingChanges={hasPendingChanges}
            onChange={updateDraft}
            onApply={apply}
            onReset={reset}
          />

          <NetRevenueKpis summary={report.summary} trend={report.trend} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="flex min-w-0 xl:col-span-2 [&>*]:flex-1">
              <NetRevenueTrendChart data={report.trend} granularity={report.granularity} />
            </div>
            <ProfitabilityCard summary={report.summary} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <FinancialBreakdownCard
              title="By department"
              description="Deals by their responsible person's department; general costs by the department that booked them"
              rows={report.byDepartment}
              emptyText="No data for the selected filters."
            />
            <FinancialBreakdownCard
              title="By pipeline"
              description="Pipeline-level summary"
              rows={report.byPipeline}
              emptyText="No data for the selected filters."
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="flex min-w-0 xl:col-span-2 [&>*]:flex-1">
              <DealNetRevenueTable rows={report.dealRows} summary={report.summary} />
            </div>
            <ExpensesByCategoryCard categories={report.byCategory} totalExpenses={report.summary.expenses} />
          </div>

          <PipelineFinancialPerformance stages={report.byStage} />

        </>
      )}
    </div>
  );
}
