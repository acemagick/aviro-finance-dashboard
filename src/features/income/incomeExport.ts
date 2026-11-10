import type { IncomeDealRow } from '../../types/income';
import { toCsv } from '../../utils/csv';
import { formatShortDate, toDateInputValue } from '../../utils/dateRange';
import type { DateRange } from '../../types/finance';

const STATUS_TEXT = { won: 'Won', inProgress: 'In progress', lost: 'Lost' } as const;

/** CSV of exactly the deals shown in the table (amounts as plain rupee numbers for Excel; empty Project Cost → blank cell). */
export function buildIncomeDealsCsv(rows: readonly IncomeDealRow[], total: number): string {
  const received = rows.reduce((sum, row) => sum + row.received, 0);
  const pending = rows.reduce((sum, row) => sum + (row.pending ?? 0), 0);
  const header = ['Deal ID', 'Deal', 'Site Name', 'Responsible Person', 'Department', 'Pipeline', 'Stage', 'Status', 'Start Date', 'Project Cost (INR)', 'Installments Received (INR)', 'Pending (INR)'];
  const body = rows.map((row) => [
    row.dealId,
    row.title,
    row.siteName ?? '',
    row.responsibleName,
    row.departmentName ?? '',
    row.pipelineName,
    row.stageName,
    STATUS_TEXT[row.status],
    formatShortDate(row.startDate),
    row.amount === null ? '' : Math.round(row.amount),
    Math.round(row.received),
    row.pending === null ? '' : Math.round(row.pending),
  ]);
  const footer = ['', `Total of ${rows.length} deal${rows.length === 1 ? '' : 's'}`, '', '', '', '', '', '', '', Math.round(total), Math.round(received), Math.round(pending)];
  return toCsv([header, ...body, footer]);
}

/** e.g. "aviro-income-deals_minal-dhote_2026-01-01_to_2026-12-31.csv". */
export function incomeExportFilename(range: DateRange, personName: string | null): string {
  const who = personName ? personName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'all-people';
  return `aviro-income-deals_${who}_${toDateInputValue(range.start)}_to_${toDateInputValue(range.end)}.csv`;
}
