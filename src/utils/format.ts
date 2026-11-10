import { CURRENCY, LOCALE } from '../config/finance';

/*
 * One place for every number format on the dashboard.
 * Components should never format ₹ amounts by hand.
 */

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

/** Full amount with Indian digit grouping, e.g. ₹11,48,364 or -₹18,000. */
export function formatCurrency(value: number): string {
  const rounded = Math.round(value);
  if (rounded < 0) return `-${currencyFormatter.format(Math.abs(rounded))}`;
  return currencyFormatter.format(rounded === 0 ? 0 : rounded);
}

/** Full amount with an explicit sign for profit/loss, e.g. +₹11,42,564 or -₹18,000. */
export function formatSignedCurrency(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${formatCurrency(rounded)}`;
  return formatCurrency(rounded);
}

/** Short amount for tight spaces, e.g. ₹11.48L, ₹1.14Cr, ₹5.8K. */
export function formatCurrencyCompact(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

/** Short amount with an explicit sign, e.g. +₹11.43L or -₹95.9K. */
export function formatSignedCurrencyCompact(value: number): string {
  if (Math.round(value) > 0) return `+${formatCurrencyCompact(value)}`;
  return formatCurrencyCompact(value);
}

/** e.g. 23.4% ; an em dash when the value is not available (e.g. no income). */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}
