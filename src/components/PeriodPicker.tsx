import { useId } from 'react';
import type { DateRange, PeriodType } from '../types/finance';
import {
  formatDateRange,
  MONTH_OPTIONS,
  monthAnchor,
  parseDateInputValue,
  QUARTER_OPTIONS,
  quarterAnchor,
  toDateInputValue,
  yearAnchor,
} from '../utils/dateRange';
import { FieldLabel } from './FieldLabel';

interface PeriodPickerProps {
  period: PeriodType;
  /** Any date inside the selected day/month/quarter/year. */
  anchorDate: Date;
  /** The exact period, shown as confirmation text. */
  dateRange: DateRange;
  /** Years offered in the Month / Quarter / Year selectors (newest first). */
  years: readonly number[];
  /** Day / Month / Quarter / Year: called with a date inside the chosen period. */
  onAnchorChange: (date: Date) => void;
  /** Custom: new start / end date. */
  onCustomStartChange: (date: Date) => void;
  onCustomEndChange: (date: Date) => void;
}

const controlClasses =
  'min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-ink-subtle focus:ring-2 focus:ring-ink/15 focus:outline-none';

const TITLES: Record<PeriodType, string> = {
  day: 'Select day',
  month: 'Select month',
  quarter: 'Select quarter',
  year: 'Select year',
  custom: 'Custom date range',
};

/**
 * Direct period selection for the filter bar:
 * Day → calendar, Month → month + year, Quarter → quarter + year,
 * Year → year, Custom → start and end calendars.
 * Shared by the Net Revenue and Income dashboards.
 */
export function PeriodPicker({
  period,
  anchorDate,
  dateRange,
  years,
  onAnchorChange,
  onCustomStartChange,
  onCustomEndChange,
}: PeriodPickerProps) {
  const baseId = useId();
  const id = (name: string) => `${baseId}-${name}`;

  const year = anchorDate.getFullYear();
  const monthIndex = anchorDate.getMonth();
  const quarter = Math.floor(monthIndex / 3) + 1;

  /** Calls `handler` only for complete, valid dates (half-typed dates are ignored). */
  const onDateInput = (handler: (date: Date) => void) => (value: string) => {
    const date = parseDateInputValue(value);
    if (date) handler(date);
  };

  const yearSelect = (onYear: (value: number) => void) => (
    <>
      <label htmlFor={id('year')} className="sr-only">Year</label>
      <select
        id={id('year')}
        value={year}
        onChange={(event) => onYear(Number(event.target.value))}
        className={`${controlClasses} w-28 shrink-0`}
      >
        {years.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel>{TITLES[period]}</FieldLabel>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {period === 'day' && (
          <>
            <label htmlFor={id('day')} className="sr-only">Day</label>
            <input
              id={id('day')}
              type="date"
              value={toDateInputValue(anchorDate)}
              onChange={(event) => onDateInput(onAnchorChange)(event.target.value)}
              className={`${controlClasses} w-44`}
            />
          </>
        )}

        {period === 'month' && (
          <>
            <label htmlFor={id('month')} className="sr-only">Month</label>
            <select
              id={id('month')}
              value={monthIndex}
              onChange={(event) => onAnchorChange(monthAnchor(year, Number(event.target.value)))}
              className={`${controlClasses} w-40`}
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {yearSelect((value) => onAnchorChange(monthAnchor(value, monthIndex)))}
          </>
        )}

        {period === 'quarter' && (
          <>
            <label htmlFor={id('quarter')} className="sr-only">Quarter</label>
            <select
              id={id('quarter')}
              value={quarter}
              onChange={(event) => onAnchorChange(quarterAnchor(year, Number(event.target.value)))}
              className={`${controlClasses} w-40`}
            >
              {QUARTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {yearSelect((value) => onAnchorChange(quarterAnchor(value, quarter)))}
          </>
        )}

        {period === 'year' && yearSelect((value) => onAnchorChange(yearAnchor(value)))}

        {period === 'custom' && (
          <>
            <label htmlFor={id('start')} className="sr-only">Start date</label>
            <input
              id={id('start')}
              type="date"
              value={toDateInputValue(dateRange.start)}
              max={toDateInputValue(dateRange.end)}
              onChange={(event) => onDateInput(onCustomStartChange)(event.target.value)}
              className={`${controlClasses} w-40 flex-1`}
            />
            <span className="text-ink-subtle" aria-hidden="true">–</span>
            <label htmlFor={id('end')} className="sr-only">End date</label>
            <input
              id={id('end')}
              type="date"
              value={toDateInputValue(dateRange.end)}
              min={toDateInputValue(dateRange.start)}
              onChange={(event) => onDateInput(onCustomEndChange)(event.target.value)}
              className={`${controlClasses} w-40 flex-1`}
            />
          </>
        )}

        {period !== 'custom' && (
          <p className="min-w-0 text-xs text-ink-subtle" aria-live="polite">
            {formatDateRange(dateRange)}
          </p>
        )}
      </div>
    </div>
  );
}
