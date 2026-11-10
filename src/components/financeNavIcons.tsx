import type { FinanceView } from '../navigation/financeViews';
import { ReceiptIcon, TrendUpIcon, WalletIcon } from './icons';

/** Icon for each Finance Module page. */
export function FinanceViewIcon({ view, className }: { view: FinanceView; className?: string }) {
  switch (view) {
    case 'net-revenue':
      return <TrendUpIcon className={className} />;
    case 'income':
      return <WalletIcon className={className} />;
    case 'expenses':
      return <ReceiptIcon className={className} />;
  }
}
