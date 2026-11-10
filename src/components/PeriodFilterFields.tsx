import { PERIOD_OPTIONS } from '../utils/dateRange';
import type { PeriodSelection } from '../types/finance';
import { FieldLabel } from './FieldLabel';
import { PeriodPicker } from './PeriodPicker';
import { SegmentedControl } from './SegmentedControl';

interface PeriodFilterFieldsProps<T extends PeriodSelection> {
  filters: T;
  /** Label above the Day | Month | ... tabs. Defaults to "Period". */
  label?: string;
  /** Years offered in the Month / Quarter / Year selectors. */
  years: readonly number[];
  onChange: (filters: T) => void;
  /** Shared helpers from features/net-revenue/filters.ts (passed in to keep this component dependency-free). */
  withPeriod: (filters: T, period: T['period']) => T;
  withAnchorDate: (filters: T, date: Date) => T;
  withCustomStart: (filters: T, date: Date) => T;
  withCustomEnd: (filters: T, date: Date) => T;
}

/**
 * The period row used by every Finance dashboard:
 * Day | Month | Quarter | Year | Custom tabs + the direct PeriodPicker.
 */
export function PeriodFilterFields<T extends PeriodSelection>({
  filters,
  label = 'Period',
  years,
  onChange,
  withPeriod,
  withAnchorDate,
  withCustomStart,
  withCustomEnd,
}: PeriodFilterFieldsProps<T>) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <FieldLabel>{label}</FieldLabel>
        <SegmentedControl
          ariaLabel={label}
          options={PERIOD_OPTIONS}
          value={filters.period}
          onChange={(period) => onChange(withPeriod(filters, period))}
          fullWidth
        />
      </div>

      <PeriodPicker
        period={filters.period}
        anchorDate={filters.anchorDate}
        dateRange={filters.dateRange}
        years={years}
        onAnchorChange={(date) => onChange(withAnchorDate(filters, date))}
        onCustomStartChange={(date) => onChange(withCustomStart(filters, date))}
        onCustomEndChange={(date) => onChange(withCustomEnd(filters, date))}
      />
    </div>
  );
}
