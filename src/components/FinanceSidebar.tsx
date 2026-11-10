import { FINANCE_VIEWS, type FinanceView } from '../navigation/financeViews';
import { FinanceViewIcon } from './financeNavIcons';

interface FinanceSidebarProps {
  active: FinanceView;
  onNavigate: (view: FinanceView) => void;
}

/**
 * Dark Finance Module sidebar (large screens). Uses the "hero" theme tokens,
 * which stay dark in both Light and Dark mode.
 */
export function FinanceSidebar({ active, onNavigate }: FinanceSidebarProps) {
  return (
    <aside className="hidden w-60 shrink-0 bg-hero lg:block" aria-label="Finance Module">
      <div className="sticky top-[65px] flex h-[calc(100vh-65px)] flex-col gap-6 overflow-y-auto p-4 text-hero-ink">
        {/* White plate so the official logo's black strokes stay visible on the dark sidebar. */}
        <div className="rounded-xl bg-white px-3 pt-3 pb-2.5 text-center">
          <img
            src={`${import.meta.env.BASE_URL}aviro-logo.png`}
            alt="AVIRO – Ready for Service"
            width={453}
            height={410}
            className="mx-auto h-16 w-auto"
          />
          {/* Fixed dark text: this plate is white in both themes. */}
          <p className="mt-2 text-[10px] font-bold tracking-[0.2em] text-neutral-800 uppercase">Finance Module</p>
        </div>

        <nav aria-label="Dashboards">
          <p className="px-3 text-[10px] font-semibold tracking-[0.18em] text-hero-muted uppercase">Dashboards</p>
          <ul className="mt-2 space-y-1">
            {FINANCE_VIEWS.map((item) => {
              const isActive = item.id === active;
              if (!item.available) {
                return (
                  <li key={item.id}>
                    <span
                      className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-hero-muted/70"
                      aria-disabled="true"
                      title={`${item.label} — ${item.note ?? 'not available yet'}`}
                    >
                      <FinanceViewIcon view={item.id} />
                      {item.label}
                      {item.note && (
                        <span className="ml-auto rounded bg-hero-track px-1.5 py-0.5 text-[10px] font-medium text-hero-muted">
                          {item.note}
                        </span>
                      )}
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-hero-ink/40 focus-visible:outline-none ${
                      isActive ? 'bg-hero-track text-hero-ink' : 'text-hero-muted hover:bg-hero-track/60 hover:text-hero-ink'
                    }`}
                  >
                    {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-hero-accent" aria-hidden="true" />}
                    <FinanceViewIcon view={item.id} />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto rounded-lg bg-hero-track/60 px-3 py-2.5 text-xs">
          <p className="flex items-center gap-2 font-medium">
            <span className="size-2 rounded-full bg-hero-accent" aria-hidden="true" />
            Connected to Bitrix24
          </p>
          <p className="mt-1 text-hero-muted">Real deal data is loaded from Bitrix24. Expenses come from the Bitrix24 Expenses Smart Process.</p>
        </div>
      </div>
    </aside>
  );
}
