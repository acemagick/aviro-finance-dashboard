import { useMemo, useState } from 'react';
import { SegmentedControl, type SegmentedOption } from '../../components/SegmentedControl';
import { formatDateRange } from '../../utils/dateRange';
import { buildIncomeReport, buildInstallmentSummary } from '../../utils/income';
import { downloadCsv } from '../../utils/csv';
// Shared with Step 1: same data loader, same filter bar.
import { NetRevenueFilterBar } from '../net-revenue/NetRevenueFilterBar';
import { useFinanceData } from '../net-revenue/useFinanceData';
import { buildIncomeDealsCsv, incomeExportFilename } from './incomeExport';
import { IncomeByStageCard } from './IncomeByStageCard';
import { IncomeDealsTable } from './IncomeDealsTable';
import { IncomeLeaderboard } from './IncomeLeaderboard';
import { IncomeShareCard } from './IncomeShareCard';
import { IncomeStatusCard } from './IncomeStatusCard';
import { IncomeSummaryCard } from './IncomeSummaryCard';
import { InstallmentPaymentsCard } from './InstallmentPaymentsCard';
import { useIncomePageFilters, type IncomeView } from './useIncomePageFilters';

const VIEW_OPTIONS: readonly SegmentedOption<IncomeView>[] = [
  { value: 'income', label: 'Income Dashboard' },
  { value: 'installments', label: 'Installment Payments' },
];

/** "Minal Dhote" → "Minal Dhote's"; "Anjali Das" → "Anjali Das'". */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

/**
 * Step 2: where AVIRO's income comes from. Income only — no expenses.
 * Two tabs share one filter bar: "Income Dashboard" (Total Project Cost, by deal Start Date) and
 * "Installment Payments" (by Payment Received Date). Each tab keeps its own date; the
 * Responsible / Department / Pipeline / Stage filters are shared.
 */
export function IncomeDashboard() {
  const { state, retry } = useFinanceData();
  const [view, setView] = useState<IncomeView>('income');
  const { draft, applied, hasPendingChanges, updateDraft, apply, reset } = useIncomePageFilters(view);

  const report = useMemo(
    () => (state.status === 'success' ? buildIncomeReport(state.data, applied) : null),
    [state, applied],
  );
  const installments = useMemo(
    () => (state.status === 'success' && view === 'installments' ? buildInstallmentSummary(state.data, applied) : null),
    [state, applied, view],
  );

  const person = report?.selectedPerson ?? null;
  const firstName = person?.name.split(' ')[0] ?? null;

  const handleExport = () => {
    if (!report) return;
    downloadCsv(
      incomeExportFilename(applied.dateRange, person?.name ?? null),
      buildIncomeDealsCsv(report.deals, report.dealsTotal),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-income uppercase">Income</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {view === 'income' ? 'Income Dashboard' : 'Installment Payments'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {view === 'income'
              ? 'Total Project Cost summed for each responsible person'
              : 'Installment payments by the date they were received'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink">
            {formatDateRange(applied.dateRange)}
          </span>
        </div>
      </div>

      {state.status === 'loading' && (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center text-sm text-ink-muted" role="status">
          Loading income data…
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-2xl border border-negative/40 bg-negative/10 p-6 text-sm text-ink" role="alert">
          <p className="font-semibold text-negative">Could not load income data.</p>
          <p className="mt-1 text-ink-muted">{state.message}</p>
          <button type="button" onClick={retry} className="mt-3 rounded-lg bg-accent px-4 py-2 font-semibold text-on-accent hover:opacity-90">
            Try again
          </button>
        </div>
      )}

      {state.status === 'success' && report && (
        <>
          <SegmentedControl ariaLabel="Income view" options={VIEW_OPTIONS} value={view} onChange={setView} fullWidth />

          <NetRevenueFilterBar
            dataset={state.data}
            periodLabel={view === 'income' ? 'Period' : 'Payment Period'}
            filters={draft}
            hasPendingChanges={hasPendingChanges}
            onChange={updateDraft}
            onApply={apply}
            onReset={reset}
          />

          {view === 'installments' && installments && (
            <>
              <InstallmentPaymentsCard summary={installments} dateRange={applied.dateRange} showResponsible={!person} />
              <p className="text-xs text-ink-subtle">
                Payment Period = the date each installment payment was received. An installment counts as received once
                its received date is filled in; Pending = Deal Amount − received to date. The Income Dashboard tab keeps its own
                period.
              </p>
            </>
          )}

          {view === 'income' && (
            <>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 md:col-span-2 xl:col-span-1 [&>*]:flex-1">
                  <IncomeSummaryCard report={report} />
                </div>
                {report.byStatus.map((item) => (
                  <IncomeStatusCard
                    key={item.status}
                    item={item}
                    shareSuffix={firstName ? `of ${possessive(firstName)} income` : 'of total income'}
                  />
                ))}
              </div>

              {/* One column: the deals table needs ~955px, more than half the page width even at 1920px. */}
              <div className="grid grid-cols-1 gap-5">
                <IncomeLeaderboard entries={report.leaderboard} selectedId={person?.id ?? null} />
                <IncomeDealsTable
                  title={person ? `${possessive(person.name)} deals` : 'All matching deals'}
                  description={
                    person
                      ? `Every matching deal where ${person.name} is the responsible person`
                      : 'Every deal matching the filters, for all responsible people'
                  }
                  rows={report.deals}
                  total={report.dealsTotal}
                  showResponsible={!person}
                  onExport={handleExport}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <IncomeShareCard
                  title={person ? `${possessive(firstName ?? person.name)} income by department` : 'Income by department'}
                  description={
                    person
                      ? 'A deal belongs to its responsible person’s Bitrix24 department'
                      : 'Total Project Cost of all matching deals, grouped by department'
                  }
                  groups={report.byDepartment}
                />
                <IncomeByStageCard
                  title={person ? `${possessive(firstName ?? person.name)} income by stage` : 'Income by stage'}
                  stages={report.byStage}
                />
              </div>

              <p className="text-xs text-ink-subtle">
                Income = Total Project Cost of deals whose Start Date is in the selected period (deals without a Total Project
                Cost show — and count as ₹0). Pending = Total Project Cost − installment payments received up to the end of the
                period. Expenses are not part of this page.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
