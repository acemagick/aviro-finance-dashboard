import { useMemo } from 'react';
import { PeriodFilterFields } from '../../components/PeriodFilterFields';
import { SearchableSelectField } from '../../components/SearchableSelectField';
import type { FinanceDataset, NetRevenueFilters } from '../../types/finance';
import { missingValueLabel, withSelectedOption } from '../expenses/expenseFilters';
import {
  ALL_VALUE,
  buildDealOptions,
  buildDepartmentOptions,
  buildPipelineOptions,
  buildResponsibleOptions,
  buildStageOptions,
  buildYearOptions,
  toFilterValue,
  withAnchorDate,
  withCustomEnd,
  withCustomStart,
  withDepartment,
  withPeriod,
  withPipeline,
} from './filters';

interface NetRevenueFilterBarProps {
  dataset: FinanceDataset;
  /** Label of the date row. Defaults to "Period". */
  periodLabel?: string;
  filters: NetRevenueFilters;
  hasPendingChanges: boolean;
  onChange: (filters: NetRevenueFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

export function NetRevenueFilterBar({
  dataset,
  periodLabel,
  filters,
  hasPendingChanges,
  onChange,
  onApply,
  onReset,
}: NetRevenueFilterBarProps) {
  const responsibleOptions = useMemo(
    () => buildResponsibleOptions(dataset, filters.departmentId),
    [dataset, filters.departmentId],
  );
  // Same Project / Deal list as Expenses, without "General" (income always belongs to a deal). A
  // selected deal that is no longer in Bitrix24 (after Refresh data) stays visible as selected.
  const dealOptions = useMemo(
    () => withSelectedOption(buildDealOptions(dataset), filters.dealId, missingValueLabel(dataset, 'deal', filters.dealId ?? '')),
    [dataset, filters.dealId],
  );
  const departmentOptions = useMemo(() => buildDepartmentOptions(dataset), [dataset]);
  const pipelineOptions = useMemo(() => buildPipelineOptions(dataset), [dataset]);
  const stageOptions = useMemo(() => buildStageOptions(dataset, filters.pipelineId), [dataset, filters.pipelineId]);

  const selectedYear = filters.anchorDate.getFullYear();
  const yearOptions = useMemo(() => buildYearOptions(dataset, selectedYear), [dataset, selectedYear]);

  return (
    <section aria-label="Dashboard filters" className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <PeriodFilterFields
        label={periodLabel}
        filters={filters}
        years={yearOptions}
        onChange={onChange}
        withPeriod={withPeriod}
        withAnchorDate={withAnchorDate}
        withCustomStart={withCustomStart}
        withCustomEnd={withCustomEnd}
      />

      {/* Same layout as the Expenses filters: Project / Deal spans two columns so deal names stay readable. */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <SearchableSelectField
            label="Project / Deal"
            searchPlaceholder="Search by deal name or #ID…"
            value={filters.dealId ?? ALL_VALUE}
            options={dealOptions}
            onChange={(value) => onChange({ ...filters, dealId: toFilterValue(value) })}
          />
        </div>
        <SearchableSelectField
          label="Responsible person"
          value={filters.responsibleId ?? ALL_VALUE}
          options={responsibleOptions}
          onChange={(value) => onChange({ ...filters, responsibleId: toFilterValue(value) })}
        />
        <SearchableSelectField
          label="Department"
          value={filters.departmentId ?? ALL_VALUE}
          options={departmentOptions}
          onChange={(value) => onChange(withDepartment(filters, toFilterValue(value), dataset))}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchableSelectField
          label="Pipeline"
          value={filters.pipelineId ?? ALL_VALUE}
          options={pipelineOptions}
          onChange={(value) => onChange(withPipeline(filters, toFilterValue(value), dataset))}
        />
        <SearchableSelectField
          label="Stage"
          value={filters.stageId ?? ALL_VALUE}
          options={stageOptions}
          onChange={(value) => onChange({ ...filters, stageId: toFilterValue(value) })}
        />
        <div className="flex items-end gap-2 sm:col-span-2 lg:justify-end">
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

      <p className="mt-3 min-h-4 text-xs text-caution" aria-live="polite">
        {hasPendingChanges ? 'You have changed the filters. Press Apply to update the dashboard.' : ''}
      </p>
    </section>
  );
}
