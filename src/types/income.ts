import type { DealStatus } from './finance';

/**
 * Types for the Step 2 Income Dashboard.
 * Income only — nothing here contains expenses or profit.
 */

/** Income of one group (a department, pipeline, stage, ...). */
export interface IncomeGroup {
  id: string;
  label: string;
  income: number;
  dealCount: number;
  /** Share of the group's parent total. `null` when that total is 0. */
  sharePct: number | null;
}

export interface LeaderboardEntry extends IncomeGroup {
  rank: number;
  departmentName: string | null;
}

export interface IncomeStatusSummary {
  status: DealStatus;
  label: string;
  description: string;
  income: number;
  dealCount: number;
  /** Share of the income shown in the main summary card. */
  sharePct: number | null;
}

export interface IncomeDealRow {
  dealId: string;
  title: string;
  siteName: string | null;
  responsibleId: string;
  responsibleName: string;
  departmentName: string | null;
  pipelineName: string;
  stageName: string;
  status: DealStatus;
  startDate: Date;
  /** Total Project Cost (income). `null` = not filled in, shown as "—" and counted as 0. */
  amount: number | null;
  /** Installments received up to the end of the selected period (only installments with a received date). */
  received: number;
  /** Total Project Cost − received (to date), never below 0. `null` when Total Project Cost is not filled in. */
  pending: number | null;
  /** True when received is more than the Total Project Cost. */
  receivedExceedsAmount: boolean;
}

/** One received installment payment, for the date-wise list. */
export interface InstallmentPaymentRow {
  /** Unique within the report, e.g. "13358-2". */
  id: string;
  receivedDate: Date;
  dealId: string;
  dealTitle: string;
  /** 1 = 1st installment, 2 = 2nd, ... */
  installmentNumber: number;
  responsibleName: string;
  amount: number;
}

/**
 * Installment figures for the section's applied Payment Period (by Payment Received Date) and the
 * dashboard's Responsible / Department / Pipeline / Stage filters. Totals cover INSTALLMENT DEALS:
 * matching deals with at least one installment recorded.
 */
export interface InstallmentSummary {
  /** Installments RECEIVED inside the period (by received date), newest first. */
  payments: InstallmentPaymentRow[];
  receivedInPeriod: number;
  /** How many deals those payments belong to. */
  payingDealCount: number;
  /** Matching deals with at least one installment recorded. */
  installmentDealCount: number;
  /** Installment deals: installments received up to the END of the period. */
  receivedToDate: number;
  /** Installment deals: Σ max(0, Deal Amount − received to date). */
  pending: number;
  /** Installment deals where received to date is more than the Deal Amount. */
  receivedExceedsAmountCount: number;
  /** Installment deals: amounts recorded without a received date (never counted as received). */
  undatedAmount: number;
  undatedCount: number;
}

export interface SelectedPerson {
  id: string;
  name: string;
  departmentName: string | null;
}

export interface IncomeReport {
  /** `null` when "All people" is selected. */
  selectedPerson: SelectedPerson | null;
  /** Income of all matching deals, ignoring the Responsible Person filter. */
  overallIncome: number;
  summary: {
    income: number;
    dealCount: number;
    averageDeal: number | null;
    /** income ÷ overallIncome × 100. */
    sharePct: number | null;
    /** How many responsible people have matching deals. */
    contributorCount: number;
  };
  byStatus: IncomeStatusSummary[];
  /** All responsible people (other filters applied), highest income first. */
  leaderboard: LeaderboardEntry[];
  byDepartment: IncomeGroup[];
  byPipeline: IncomeGroup[];
  /** In pipeline stage order. */
  byStage: IncomeGroup[];
  /** Highest amount first. */
  deals: IncomeDealRow[];
  dealsTotal: number;
}
