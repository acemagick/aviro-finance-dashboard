import { useMemo } from 'react';
import { useDraftFilters } from '../../hooks/useDraftFilters';
import { GENERAL_EXPENSES_DEAL_ID } from '../../types/expenses';
import { downloadCsv } from '../../utils/csv';
import { formatDateRange } from '../../utils/dateRange';
import { buildExpenseReport } from '../../utils/expenses';
import { formatCurrency } from '../../utils/format';
// Shared with the other dashboards: same data loader.
import { useFinanceData } from '../net-revenue/useFinanceData';
import { ExpenseCategoryChart } from './ExpenseCategoryChart';
import { ExpenseCountingRules } from './ExpenseCountingRules';
import { ExpenseEntriesCard } from './ExpenseEntriesCard';
import { buildExpenseItemsCsv, expenseExportFilename } from './expenseExport';
import {
  createDefaultExpenseFilters,
  dealScopeExpenses,
  describeNonDealFilters,
  emptyFieldNotes,
  expenseFiltersEqual,
  explainEmptyResult,
} from './expenseFilters';
import { ExpenseItemsTable } from './ExpenseItemsTable';
import { ExpensesFilterBar } from './ExpensesFilterBar';
import { ExpenseSummaryCard } from './ExpenseSummaryCard';
import { QuickCategoryChips } from './QuickCategoryChips';
import { TopExpenseCategoryCard } from './TopExpenseCategoryCard';

/** Expense entries from the Bitrix24 "Expenses" and "Essentials only" smart processes, linked to deals. */
export function ExpensesDashboard() {
  const { state, retry } = useFinanceData();
  const { draft, applied, hasPendingChanges, updateDraft, apply, reset, applyNow } = useDraftFilters(
    createDefaultExpenseFilters,
    expenseFiltersEqual,
  );

  const report = useMemo(
    () => (state.status === 'success' ? buildExpenseReport(state.data, applied) : null),
    [state, applied],
  );

  const isGeneralSelected = applied.dealId === GENERAL_EXPENSES_DEAL_ID;
  const dataset = state.status === 'success' ? state.data : null;
  // Quick-category chips: counted Categories; with a Project / Deal applied, only those its expenses use.
  const countedCategories = useMemo(() => {
    if (!dataset) return [];
    const scope = dealScopeExpenses(dataset, applied.dealId);
    const used = scope ? new Set(scope.map((expense) => expense.categoryId)) : null;
    return dataset.expenseCategoryOptions.filter((option) => option.treatment === 'expense' && (used === null || used.has(option.id)));
  }, [dataset, applied.dealId]);
  // A Category that is not counted as an expense (e.g. money received): its records are shown, not totalled.
  const selectedUncounted = dataset?.expenseCategoryOptions.find(
    (option) => option.id === applied.category && option.treatment !== 'expense',
  );
  const dealName = report?.dealSummary?.title ?? null;
  // The deal card always counts ALL of the deal's linked expenses (any date, no other filter); the
  // sections below apply every filter. Say so when the other filters leave out some of them.
  const dealSummary = report?.dealSummary ?? null;
  const dealExpensesHidden =
    dataset && report && dealSummary && report.entryCount < dealSummary.linkedEntryCount
      ? { shown: report.entryCount, filters: describeNonDealFilters(dataset, applied) }
      : null;

  // Why nothing matches, and records left out only because a filtered field is empty in Bitrix24.
  const emptyReasons = useMemo(
    () => (dataset && report && report.rows.length === 0 ? explainEmptyResult(dataset, applied) : []),
    [dataset, report, applied],
  );
  const fieldNotes = useMemo(() => (dataset ? emptyFieldNotes(dataset, applied) : []), [dataset, applied]);

  // "How expenses are counted" is for the matching records; say which filters those are.
  const countingScope = useMemo(() => {
    if (!dataset) return [];
    const deal =
      applied.dealId === null
        ? []
        : [`Project / Deal: ${applied.dealId === GENERAL_EXPENSES_DEAL_ID ? 'General (not linked to a deal)' : `${dealName ?? 'Deal'} (#${applied.dealId})`}`];
    return [...deal, ...describeNonDealFilters(dataset, applied)];
  }, [dataset, applied, dealName]);

  const handleExport = () => {
    if (!report) return;
    downloadCsv(expenseExportFilename(applied.dateRange), buildExpenseItemsCsv(report.rows, report.total));
  };

  let tableDescription = 'All records matching the filters';
  if (dealName) tableDescription = `All records linked to ${dealName}`;
  else if (isGeneralSelected) tableDescription = 'Records not linked to any deal';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-expense uppercase">Expenses</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Expense Dashboard</h1>
          <p className="mt-1 text-sm text-ink-muted">Bitrix24 Expenses and Essentials only records, by Category, linked to deals</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink">
            {formatDateRange(applied.dateRange)}
          </span>
        </div>
      </div>

      {state.status === 'loading' && (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center text-sm text-ink-muted" role="status">
          Loading expense data…
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-2xl border border-negative/40 bg-negative/10 p-6 text-sm text-ink" role="alert">
          <p className="font-semibold text-negative">Could not load expense data.</p>
          <p className="mt-1 text-ink-muted">{state.message}</p>
          <button type="button" onClick={retry} className="mt-3 rounded-lg bg-accent px-4 py-2 font-semibold text-on-accent hover:opacity-90">
            Try again
          </button>
        </div>
      )}

      {state.status === 'success' && report && (
        <>
          <ExpensesFilterBar
            dataset={state.data}
            filters={draft}
            hasPendingChanges={hasPendingChanges}
            onChange={updateDraft}
            onApply={apply}
            onReset={reset}
          />

          <QuickCategoryChips
            categories={countedCategories}
            selected={applied.category}
            onSelect={(category) => applyNow({ category })}
          />

          {dealSummary && dealExpensesHidden && (
            <p className="rounded-2xl border border-caution/40 bg-caution/10 px-5 py-3 text-sm text-ink" role="note">
              <b>{dealSummary.title}</b> has {dealSummary.linkedEntryCount} linked expense entr
              {dealSummary.linkedEntryCount === 1 ? 'y' : 'ies'} ({formatCurrency(dealSummary.linkedExpenses)}) in total, shown in the
              deal card. {dealExpensesHidden.shown === 0 ? 'None of them match' : `Only ${dealExpensesHidden.shown} of them match`} the
              other filters below: {dealExpensesHidden.filters.join(' · ')}.
            </p>
          )}

          {selectedUncounted && (
            <p className="rounded-2xl border border-caution/40 bg-caution/10 px-5 py-3 text-sm text-ink" role="note">
              <b>{selectedUncounted.label}</b> is not included in the Expense Total: its records are listed below, marked “Not in
              Expense Total”, and the totals show ₹0. {selectedUncounted.reason} See “How expenses are counted” below.
            </p>
          )}

          {emptyReasons.length > 0 && (
            <div className="rounded-2xl border border-caution/40 bg-caution/10 px-5 py-3 text-sm text-ink" role="note">
              {emptyReasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          )}

          {fieldNotes.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface px-5 py-3 text-sm text-ink-muted" role="note">
              {fieldNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 md:col-span-2 xl:col-span-1 [&>*]:flex-1">
              <ExpenseSummaryCard report={report} isGeneralSelected={isGeneralSelected} />
            </div>
            <ExpenseEntriesCard
              recordCount={report.recordCount}
              inTotalCount={report.entryCount}
              notInTotal={report.notInTotal}
              trend={report.trend}
              granularity={report.granularity}
              dateRange={applied.dateRange}
            />
            <TopExpenseCategoryCard top={report.topCategory} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,4fr)_minmax(0,9fr)]">
            <ExpenseCategoryChart
              categories={report.byCategory}
              total={report.total}
              categoriesUsed={report.categoriesUsed}
              notInTotal={report.notInTotalByCategory}
            />
            <ExpenseItemsTable
              description={tableDescription}
              rows={report.rows}
              total={report.total}
              notInTotal={report.notInTotal}
              showDeal={!dealName}
              onExport={handleExport}
            />
          </div>

          {state.data.expenses.length === 0 && (
            <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-ink-muted" role="note">
              No expense records were found in Bitrix24 yet. Expense figures will appear here as soon as records are added.
            </p>
          )}

          <ExpenseCountingRules
            summary={report.countingSummary}
            expensesRecordCount={report.expensesRecordCount}
            scope={countingScope}
          />
        </>
      )}
    </div>
  );
}
