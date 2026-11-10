import type { EssentialsCategorySummary } from '../../types/finance';
import { formatCurrency } from '../../utils/format';

interface ExpenseCountingRulesProps {
  /** Per Category, for the records matching the applied filters. */
  summary: readonly EssentialsCategorySummary[];
  /** Matching records of the "Expenses" smart process (listed, never counted). */
  expensesRecordCount: number;
  /** The applied filters the counts are for, e.g. ['Project / Deal: …', 'Period …']. */
  scope: readonly string[];
}

const count = (value: number) => value.toLocaleString('en-IN');

/** Why some records of a counted Category are left out, and how many got an employee / department. */
function countedDetail(row: EssentialsCategorySummary): string {
  const left = [
    row.failed > 0 && `${count(row.failed)} in the Failed stage`,
    row.noAmount > 0 && `${count(row.noAmount)} without an Expenses Bill Amount`,
    row.noDate > 0 && `${count(row.noDate)} without a bill date`,
  ].filter(Boolean);
  const parts = [
    left.length > 0 && `Left out: ${left.join(', ')}.`,
    `Employee matched for ${count(row.employeeMatched)} of ${count(row.counted)}, department for ${count(row.departmentMatched)}.`,
  ].filter(Boolean);
  return parts.join(' ');
}

/**
 * Explains, per Bitrix24 Category, which "Essentials only" records are in the Expense Total and
 * why the others are not, so no record disappears from the totals without a reason.
 */
export function ExpenseCountingRules({ summary, expensesRecordCount, scope }: ExpenseCountingRulesProps) {

  return (
    <details className="group rounded-2xl border border-line bg-surface px-5 py-4 text-sm">
      <summary className="-my-3 cursor-pointer py-3 font-semibold text-ink marker:text-ink-subtle">How expenses are counted</summary>
      <div className="mt-3 space-y-3 text-ink-muted">
        <p>
          Counts below are for the records matching the applied filters: {scope.join(' · ')}.
        </p>
        <p>
          <b className="text-ink">Expense Total</b> = the <b>Essentials only</b> records of <b>every</b> Category that have an{' '}
          <b>Expenses Bill Amount</b> and a bill date. Only the Expenses Bill Amount is used — never another amount field. The{' '}
          {count(expensesRecordCount)} matching record{expensesRecordCount === 1 ? '' : 's'} of the separate Bitrix24 <b>Expenses</b>{' '}
          smart process (shown as “No Category”) {expensesRecordCount === 1 ? 'is' : 'are'} listed but not counted: that process has
          no Expenses Bill Amount field. Each record is counted once. Records in the Failed stage, or without an Expenses Bill Amount or
          bill date, are left out; records with any other payment status (pending, on hold, partly paid) are counted.
        </p>
        <p>
          Every Category from Bitrix24 can be selected in the filter, and every record is listed in Expense items. Records
          that are not in the Expense Total (no Expenses Bill Amount, no bill date, Failed stage) are marked “Not in Expense
          Total” with the reason; they are never added to any total. Records without a bill date are shown on their
          Category’s own date, else their Created on day (marked “Created on”); records without an Expenses Bill Amount are
          shown as “—” and match only “Any amount”. Employee is each record’s Bitrix24 Responsible person, in Expense items and in the
          filter; the filter lists active employees only. Department and Site are always the
          record’s own Bitrix24 value (never another field); for Essentials only the typed department is linked to a
          company department only when it matches exactly one; otherwise the
          typed value is shown and filtered exactly as typed. Empty fields are shown as “—”.
        </p>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[36rem] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">
                <th scope="col" className="py-2 pr-3">Category (Bitrix24)</th>
                <th scope="col" className="py-2 pr-3">Treatment</th>
                <th scope="col" className="py-2 pr-3 text-right">Records</th>
                <th scope="col" className="py-2 text-right">In Expense Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {summary.map((row) => {
                const detail = (row.categoryId === null ? 'The Category field is empty on these records. ' : '') + countedDetail(row);
                return (
                  <tr key={row.categoryId ?? 'none'} className="align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-ink">{row.label}</p>
                      <p className="mt-0.5 text-xs text-ink-subtle">{detail}</p>
                    </td>
                    <td className="py-2 pr-3 font-medium text-positive">In Expense Total with an Expenses Bill Amount and bill date</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{count(row.records)}</td>
                    <td className="py-2 text-right whitespace-nowrap tabular-nums">
                      {`${count(row.counted)} · ${formatCurrency(row.countedAmount)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
