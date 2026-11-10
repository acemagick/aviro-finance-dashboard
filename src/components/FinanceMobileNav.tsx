import { FINANCE_VIEWS, type FinanceView } from '../navigation/financeViews';
import { FinanceViewIcon } from './financeNavIcons';

interface FinanceMobileNavProps {
  active: FinanceView;
  onNavigate: (view: FinanceView) => void;
}

/** Compact page switcher shown instead of the sidebar on phones and tablets. */
export function FinanceMobileNav({ active, onNavigate }: FinanceMobileNavProps) {
  return (
    <nav aria-label="Dashboards" className="border-b border-line bg-surface lg:hidden">
      <ul className="flex gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {FINANCE_VIEWS.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                disabled={!item.available}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm sm:px-3 font-medium focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive ? 'bg-accent text-on-accent' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                }`}
              >
                <FinanceViewIcon view={item.id} />
                {item.label}
                {!item.available && item.note && <span className="text-[10px] font-normal">({item.note})</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
