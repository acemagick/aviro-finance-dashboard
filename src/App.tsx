import { FinanceMobileNav } from './components/FinanceMobileNav';
import { FinanceSidebar } from './components/FinanceSidebar';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { ExpensesDashboard } from './features/expenses/ExpensesDashboard';
import { IncomeDashboard } from './features/income/IncomeDashboard';
import { NetRevenueDashboard } from './features/net-revenue/NetRevenueDashboard';
import { FinanceRefreshProvider } from './features/refresh/FinanceRefreshProvider';
import { RefreshDataButton } from './features/refresh/RefreshDataButton';
import { useFinanceView } from './navigation/useFinanceView';
import { ThemeProvider } from './theme/ThemeProvider';

function App() {
  const { view, navigate } = useFinanceView();

  return (
    <ThemeProvider>
      <FinanceRefreshProvider>
        <div className="min-h-screen bg-canvas text-ink">
          <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
            <div className="flex items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {/*
                  Official AVIRO logo (public/aviro-logo.png, transparent background).
                  Dark mode adds a white plate so the logo's black strokes stay visible.
                  alt="" because the "AVIRO" text right next to it already names the brand.
                */}
                <img
                  src={`${import.meta.env.BASE_URL}aviro-logo.png`}
                  alt=""
                  width={453}
                  height={410}
                  className="h-10 w-auto shrink-0 rounded-md p-0.5 dark:bg-white"
                />
                <span className="text-lg font-extrabold tracking-[0.18em] text-ink">AVIRO</span>
                {/* Hidden on phones so the header fits on one row next to Refresh + theme buttons. */}
                <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
                <span className="hidden text-sm font-medium text-ink-muted sm:inline">Finance Module</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <RefreshDataButton />
                <ThemeSwitcher />
              </div>
            </div>
          </header>

          <div className="flex min-h-[calc(100vh-65px)]">
            <FinanceSidebar active={view} onNavigate={navigate} />

            <div className="min-w-0 flex-1">
              <FinanceMobileNav active={view} onNavigate={navigate} />
              <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                {view === 'net-revenue' && <NetRevenueDashboard />}
                {view === 'income' && <IncomeDashboard />}
                {view === 'expenses' && <ExpensesDashboard />}
              </main>
            </div>
          </div>
        </div>
      </FinanceRefreshProvider>
    </ThemeProvider>
  );
}

export default App;
