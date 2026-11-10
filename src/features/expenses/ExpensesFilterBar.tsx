import { useMemo } from 'react';
import { PeriodFilterFields } from '../../components/PeriodFilterFields';
import { SearchableSelectField } from '../../components/SearchableSelectField';
import { SelectField } from '../../components/SelectField';
import type { ExpenseAmountRangeId, ExpenseFilters } from '../../types/expenses';
import type { FinanceDataset } from '../../types/finance';
import {
  ALL_VALUE,
  buildYearOptions,
  toFilterValue,
  withAnchorDate,
  withCustomEnd,
  withCustomStart,
  withPeriod,
} from '../net-revenue/filters';
import {
  buildAmountOptions,
  buildExpenseDealOptions,
  buildDependentOptions,
  missingValueLabel,
  pruneToOptions,
  withSelectedOption,
} from './expenseFilters';

interface ExpensesFilterBarProps {
  dataset: FinanceDataset;
  filters: ExpenseFilters;
  hasPendingChanges: boolean;
  onChange: (filters: ExpenseFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

export function ExpensesFilterBar({ dataset, filters, hasPendingChanges, onChange, onApply, onReset }: ExpensesFilterBarProps) {
  const dealOptions = useMemo(() => buildExpenseDealOptions(dataset), [dataset]);
  const amountOptions = useMemo(() => buildAmountOptions(), []);
  // Category / Employee / Department / Site options follow the Project / Deal being edited:
  // only that deal's values when one is selected, the global lists otherwise.
  const dependent = useMemo(() => buildDependentOptions(dataset, filters.dealId), [dataset, filters.dealId]);
  // A selected value that is no longer an option (e.g. removed in Bitrix24, then Refresh data) stays
  // visible in its field, so the field never says "All" while a filter is applied.
  const shown = useMemo(
    () => ({
      deal: withSelectedOption(dealOptions, filters.dealId, missingValueLabel(dataset, 'deal', filters.dealId ?? '')),
      category: withSelectedOption(dependent.category, filters.category, missingValueLabel(dataset, 'category', filters.category ?? '')),
      employee: withSelectedOption(dependent.employee, filters.employeeId, missingValueLabel(dataset, 'employee', filters.employeeId ?? '')),
      department: withSelectedOption(
        dependent.department,
        filters.departmentId,
        missingValueLabel(dataset, 'department', filters.departmentId ?? ''),
      ),
      site: withSelectedOption(dependent.site, filters.siteName, filters.siteName ?? ''),
    }),
    [dataset, dealOptions, dependent, filters],
  );

  // A new Project / Deal: keep every refinement still valid for it, reset the others to "All".
  const changeDeal = (value: string) => {
    const next = { ...filters, dealId: toFilterValue(value) };
    onChange(pruneToOptions(next, buildDependentOptions(dataset, next.dealId)));
  };
  const selectedYear = filters.anchorDate.getFullYear();
  const yearOptions = useMemo(() => buildYearOptions(dataset, selectedYear), [dataset, selectedYear]);

  return (
    <section aria-label="Expense filters" className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <PeriodFilterFields
        filters={filters}
        years={yearOptions}
        onChange={onChange}
        withPeriod={withPeriod}
        withAnchorDate={withAnchorDate}
        withCustomStart={withCustomStart}
        withCustomEnd={withCustomEnd}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <SearchableSelectField
            label="Project / Deal"
            searchPlaceholder="Search by deal name or #ID…"
            value={filters.dealId ?? ALL_VALUE}
            options={shown.deal}
            onChange={changeDeal}
          />
        </div>
        <SelectField
          label="Expense category"
          value={filters.category ?? ALL_VALUE}
          options={shown.category}
          onChange={(value) => onChange({ ...filters, category: toFilterValue(value) })}
        />
        <SelectField
          label="Amount"
          value={filters.amountRange}
          options={amountOptions}
          onChange={(value) => onChange({ ...filters, amountRange: value as ExpenseAmountRangeId })}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <SearchableSelectField
          label="Employee name"
          value={filters.employeeId ?? ALL_VALUE}
          options={shown.employee}
          onChange={(value) => onChange({ ...filters, employeeId: toFilterValue(value) })}
        />
        <SearchableSelectField
          label="Department"
          value={filters.departmentId ?? ALL_VALUE}
          options={shown.department}
          onChange={(value) => onChange({ ...filters, departmentId: toFilterValue(value) })}
        />
        <SearchableSelectField
          label="Site name"
          value={filters.siteName ?? ALL_VALUE}
          options={shown.site}
          onChange={(value) => onChange({ ...filters, siteName: toFilterValue(value) })}
        />
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={!hasPendingChanges}
            className="flex-1 rounded-lg border border-transparent bg-accent px-6 py-2 text-sm max-sm:min-h-11 font-semibold text-on-accent hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 lg:flex-none"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-lg border border-line bg-surface px-4 py-2 text-sm max-sm:min-h-11 font-medium text-ink hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none lg:flex-none"
          >
            Reset
          </button>
        </div>
      </div>

      {dependent.scopedToDeal && (
        <p className="mt-2 text-xs text-ink-subtle">Category, employee, department and site options are limited to the selected project / deal.</p>
      )}

      <p className="mt-3 min-h-4 text-xs text-caution" aria-live="polite">
        {hasPendingChanges ? 'You have changed the filters. Press Apply to update the dashboard.' : ''}
      </p>
    </section>
  );
}
