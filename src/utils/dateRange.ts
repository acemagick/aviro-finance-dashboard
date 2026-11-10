import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  isValid,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import type { DateRange, PeriodType, TrendGranularity } from '../types/finance';

/** Every period type except Custom has a fixed length. */
export type FixedPeriod = Exclude<PeriodType, 'custom'>;

export const PERIOD_OPTIONS: ReadonlyArray<{ value: PeriodType; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom' },
];

/** Weeks start on Monday. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

/** The full day/month/quarter/year that contains `anchor`. */
export function getPeriodRange(period: FixedPeriod, anchor: Date): DateRange {
  switch (period) {
    case 'day':
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    case 'month':
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    case 'quarter':
      return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) };
    case 'year':
      return { start: startOfYear(anchor), end: endOfYear(anchor) };
  }
}

/** Month names for the Month picker (index 0 = January). */
export const MONTH_OPTIONS: ReadonlyArray<{ value: number; label: string }> = Array.from({ length: 12 }, (_, index) => ({
  value: index,
  label: format(new Date(2000, index, 1), 'MMMM'),
}));

/** Quarter picker options. Calendar quarters: Q1 = Jan–Mar … Q4 = Oct–Dec. */
export const QUARTER_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'Q1 (Jan – Mar)' },
  { value: 2, label: 'Q2 (Apr – Jun)' },
  { value: 3, label: 'Q3 (Jul – Sep)' },
  { value: 4, label: 'Q4 (Oct – Dec)' },
];

/** The anchor date for a chosen month (monthIndex 0 = January). */
export function monthAnchor(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

/** The anchor date for a chosen quarter (1–4). */
export function quarterAnchor(year: number, quarter: number): Date {
  return new Date(year, (quarter - 1) * 3, 1);
}

/** The anchor date for a chosen year. */
export function yearAnchor(year: number): Date {
  return new Date(year, 0, 1);
}

/**
 * How the trend chart groups data for the selected period.
 * A single bar is not useful, so each period is split into smaller steps:
 * Day → 1 day, Month → weeks, Quarter → months, Year → months,
 * Custom → chosen from the length of the range.
 */
export function granularityForPeriod(period: PeriodType, range: DateRange): TrendGranularity {
  switch (period) {
    case 'day':
      return 'day';
    case 'month':
      return 'week';
    case 'quarter':
    case 'year':
      return 'month';
    case 'custom': {
      const days = differenceInCalendarDays(range.end, range.start) + 1;
      if (days <= 31) return 'day';
      if (days <= 92) return 'week';
      if (days <= 731) return 'month';
      if (days <= 1826) return 'quarter';
      return 'year';
    }
  }
}

export function isInRange(date: Date, range: DateRange): boolean {
  return isWithinInterval(date, range);
}

export function bucketStart(date: Date, granularity: TrendGranularity): Date {
  switch (granularity) {
    case 'day':
      return startOfDay(date);
    case 'week':
      return startOfWeek(date, WEEK_OPTIONS);
    case 'month':
      return startOfMonth(date);
    case 'quarter':
      return startOfQuarter(date);
    case 'year':
      return startOfYear(date);
  }
}

/** All period start dates inside the range, e.g. every month start. */
export function listBuckets(range: DateRange, granularity: TrendGranularity): Date[] {
  switch (granularity) {
    case 'day':
      return eachDayOfInterval(range);
    case 'week':
      return eachWeekOfInterval(range, WEEK_OPTIONS);
    case 'month':
      return eachMonthOfInterval(range);
    case 'quarter':
      return eachQuarterOfInterval(range);
    case 'year':
      return eachYearOfInterval(range);
  }
}

export function bucketKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function bucketLabel(date: Date, granularity: TrendGranularity): string {
  switch (granularity) {
    case 'day':
    case 'week':
      return format(date, 'dd MMM');
    case 'month':
      return format(date, 'MMM yy');
    case 'quarter':
      return format(date, 'QQQ yy');
    case 'year':
      return format(date, 'yyyy');
  }
}

export const GRANULARITY_LABELS: Record<TrendGranularity, string> = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  quarter: 'quarterly',
  year: 'yearly',
};

/** Value for an <input type="date">, e.g. "2026-09-23". */
export function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Parses an <input type="date"> value. Returns null for empty/invalid input. */
export function parseDateInputValue(value: string): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

/** e.g. "09 Sep 2026". */
export function formatShortDate(date: Date): string {
  return format(date, 'dd MMM yyyy');
}

/** e.g. "01 Apr 2026 – 30 Sep 2026". */
export function formatDateRange(range: DateRange): string {
  const start = formatShortDate(range.start);
  const end = formatShortDate(range.end);
  return start === end ? start : `${start} – ${end}`;
}
