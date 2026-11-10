import { PersonAvatar } from '../../components/PersonAvatar';
import type { IncomeReport } from '../../types/income';
import { formatCurrency, formatPercent } from '../../utils/format';

interface IncomeSummaryCardProps {
  report: IncomeReport;
}

const SIZE = 88;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Share of overall income as a small ring. */
function ShareRing({ sharePct }: { sharePct: number | null }) {
  const filled = sharePct === null ? 0 : Math.min(Math.max(sharePct, 0), 100) / 100;
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full -rotate-90"
        role="img"
        aria-label={sharePct === null ? 'Share of total income not available' : `${formatPercent(sharePct)} of total income`}
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-on-income-strong/20" />
        {filled > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            className="stroke-net"
            strokeDasharray={`${filled * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-base font-bold tabular-nums">{formatPercent(sharePct)}</span>
        <span className="text-[10px] text-on-income-strong-muted">of total</span>
      </div>
    </div>
  );
}

/** The main card: selected person's income, or overall income for "All people". */
export function IncomeSummaryCard({ report }: IncomeSummaryCardProps) {
  const { selectedPerson, summary } = report;
  const dealText = `${summary.dealCount} deal${summary.dealCount === 1 ? '' : 's'}`;
  const averageText = summary.averageDeal === null ? '' : ` · avg ${formatCurrency(summary.averageDeal)}`;

  return (
    <section
      aria-label="Income summary"
      className="flex min-w-0 flex-col gap-4 rounded-2xl bg-income-strong p-5 text-on-income-strong sm:flex-row sm:items-center"
    >
      {selectedPerson ? (
        <PersonAvatar id={selectedPerson.id} name={selectedPerson.name} size="lg" className="bg-net text-on-net" />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-on-income-strong/15 text-xs font-bold" aria-hidden="true">
          ALL
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-on-income-strong-muted">
          {selectedPerson ? (
            <>
              <span className="font-semibold text-on-income-strong">{selectedPerson.name}</span>
              {selectedPerson.departmentName && ` · ${selectedPerson.departmentName}`}
            </>
          ) : (
            <>
              <span className="font-semibold text-on-income-strong">All responsible people</span>
              {` · ${summary.contributorCount} ${summary.contributorCount === 1 ? 'person' : 'people'} with deals`}
            </>
          )}
        </p>
        <p className="mt-1 truncate text-3xl font-bold tracking-tight tabular-nums sm:text-4xl" title={formatCurrency(summary.income)}>
          {formatCurrency(summary.income)}
        </p>
        <p className="mt-1 text-xs text-on-income-strong-muted">
          {summary.dealCount === 0 ? 'No deals match these filters' : `Sum of Total Project Cost on ${dealText}${averageText}`}
        </p>
      </div>

      {selectedPerson && <ShareRing sharePct={summary.sharePct} />}
    </section>
  );
}
