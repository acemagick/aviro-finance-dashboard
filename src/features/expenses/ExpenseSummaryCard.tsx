import type { DealStatus } from '../../types/finance';
import type { ExpenseDealSummary, ExpenseReport } from '../../types/expenses';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../../utils/format';
import { getInitials } from '../../utils/income';

interface ExpenseSummaryCardProps {
  report: ExpenseReport;
  /** True when the Project filter is "General (not linked to a deal)". */
  isGeneralSelected: boolean;
}

const STATUS_BADGE: Record<DealStatus, { label: string; className: string }> = {
  won: { label: 'Won', className: 'bg-hero-accent/20 text-hero-accent' },
  inProgress: { label: 'In progress', className: 'bg-net/20 text-net' },
  lost: { label: 'Lost', className: 'bg-negative/25 text-negative' },
};

/**
 * One summary figure, always shown in full: the amount scales with the figure's own width
 * (between 18 and 24px) instead of being cut off; narrow cards put the first figure on its own row.
 */
function Figure({ label, value, className = '', span = false }: { label: string; value: string; className?: string; span?: boolean }) {
  return (
    <div className={`@container min-w-0 ${span ? 'col-span-2 @md:col-span-1' : ''}`}>
      <p className="text-[11px] text-hero-muted">{label}</p>
      <p className={`text-[length:clamp(1.125rem,13cqi,1.5rem)] font-bold whitespace-nowrap tabular-nums ${className}`}>{value}</p>
    </div>
  );
}

function NotInTotalLine({ report }: { report: ExpenseReport }) {
  if (report.notInTotal.count === 0) return null;
  return (
    <p className="mt-2 text-[11px] text-hero-muted">
      Shown records not in Expense Total: {report.notInTotal.count.toLocaleString('en-IN')} · {formatCurrency(report.notInTotal.amount)}
    </p>
  );
}

/**
 * Why the deal's income can be lower than expected: income is only the installments (1st–7th
 * Installment Payment) entered on the deal in Bitrix24 WITH their received date — never the Deal
 * Amount, and never payments recorded elsewhere (e.g. unlinked Payment Collection records).
 */
function InstalmentNote({ deal }: { deal: ExpenseDealSummary }) {
  if (deal.instalmentCount === 0) {
    return (
      <p className="mt-2 text-[11px] text-hero-muted">
        No installment payments are filled in on this deal in Bitrix24 (1st–7th Installment Payment), so income is ₹0.
      </p>
    );
  }
  if (deal.undatedInstalments.count === 0) return null;
  const n = deal.undatedInstalments.count;
  return (
    <p className="mt-2 text-[11px] text-hero-muted">
      {n} installment{n === 1 ? '' : 's'} ({formatCurrency(deal.undatedInstalments.amount)}) {n === 1 ? 'has' : 'have'} no received date in
      Bitrix24, so {n === 1 ? 'it is' : 'they are'} not counted as income yet.
    </p>
  );
}

/**
 * Dark summary card.
 * - Deal selected: installments received (income), all linked expenses, net = income − expenses, spend bar.
 * - Otherwise: totals for the current filters (no fake "selected project").
 * All figures are the Expense Total; records shown but not in it are only in the separate line.
 */
export function ExpenseSummaryCard({ report, isGeneralSelected }: ExpenseSummaryCardProps) {
  const deal = report.dealSummary;

  if (!deal) {
    const title = isGeneralSelected ? 'General expenses' : 'All projects';
    const subtitle = isGeneralSelected
      ? 'Office and other costs not linked to a deal'
      : `${report.linkedDealCount} linked deal${report.linkedDealCount === 1 ? '' : 's'} · select a project to see its deal summary`;
    const linkedShare = report.total > 0 ? (report.dealLinkedTotal / report.total) * 100 : 0;
    return (
      <section aria-label="Expense summary" className="@container flex min-w-0 flex-col rounded-2xl bg-hero p-5 text-hero-ink">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-expense text-sm font-bold text-white" aria-hidden="true">
            {isGeneralSelected ? 'G' : 'ALL'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{title}</p>
            <p className="truncate text-xs text-hero-muted">{subtitle}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 @md:grid-cols-3">
          <Figure label="Total expenses" value={formatCurrency(report.total)} className="text-expense" span />
          <Figure label="Linked to deals" value={formatCurrency(report.dealLinkedTotal)} />
          <Figure label="General" value={formatCurrency(report.generalTotal)} />
        </div>
        <NotInTotalLine report={report} />
        <div className="mt-auto pt-4">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-hero-track" aria-hidden="true">
            {report.total > 0 && (
              <>
                <div className="h-full bg-expense" style={{ width: `${linkedShare}%` }} />
                <div className="h-full flex-1 bg-net" />
              </>
            )}
          </div>
          <p className="mt-1.5 flex justify-between gap-3 text-[11px] text-hero-muted">
            <span>Deal-linked {formatPercent(report.total > 0 ? linkedShare : null)}</span>
            <span>General {formatPercent(report.total > 0 ? 100 - linkedShare : null)}</span>
          </p>
        </div>
      </section>
    );
  }

  const badge = STATUS_BADGE[deal.status];
  const spent = deal.spentPct === null ? 0 : Math.min(Math.max(deal.spentPct, 0), 100);
  const overBudget = deal.netAmount < 0;

  return (
    <section aria-label={`Deal summary: ${deal.title}`} className="@container flex min-w-0 flex-col rounded-2xl bg-hero p-5 text-hero-ink">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-expense text-sm font-bold text-white" aria-hidden="true">
          {getInitials(deal.title).slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold" title={deal.title}>{deal.title}</p>
          <p className="truncate text-xs text-hero-muted">
            Linked deal #{deal.dealId} · Responsible: {deal.responsibleName} · {deal.stageName}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 @md:grid-cols-3">
        <Figure label="Instalments received (income)" value={formatCurrency(deal.income)} span />
        <Figure label="Expenses" value={formatCurrency(deal.linkedExpenses)} className="text-expense" />
        <Figure
          label={overBudget ? 'Loss (income − expenses)' : 'Net (income − expenses)'}
          value={formatSignedCurrency(deal.netAmount)}
          className={overBudget ? 'text-negative' : 'text-net'}
        />
      </div>
      <NotInTotalLine report={report} />
      <InstalmentNote deal={deal} />

      <div className="mt-auto pt-4">
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-hero-track" aria-hidden="true">
          <div className="h-full bg-expense" style={{ width: `${spent}%` }} />
          {!overBudget && deal.income > 0 && <div className="h-full flex-1 bg-net" />}
        </div>
        <p className="mt-1.5 flex justify-between gap-3 text-[11px] text-hero-muted">
          <span>
            {formatPercent(deal.spentPct)} of income spent · {deal.linkedEntryCount} expense entr{deal.linkedEntryCount === 1 ? 'y' : 'ies'} (all dates, other filters not applied)
          </span>
          <span>{formatPercent(deal.marginPct)} margin</span>
        </p>
      </div>
    </section>
  );
}
