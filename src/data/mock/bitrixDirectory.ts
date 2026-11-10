import type {
  BitrixDealCategory,
  BitrixDealStage,
  BitrixDepartment,
  BitrixUser,
} from '../../types/bitrix';

/**
 * MOCK company directory in raw Bitrix24 format.
 *
 * - "Minal Dhote" is the responsible person seen on real deal #13088.
 *   Her department here is a guess for the demo.
 * - All other people and departments are fictional placeholders.
 */

export const MOCK_BITRIX_DEPARTMENTS: BitrixDepartment[] = [
  { ID: '1', NAME: 'AVIRO' },
  { ID: '3', NAME: 'Sales', PARENT: '1' },
  { ID: '5', NAME: 'Projects & Execution', PARENT: '1' },
  { ID: '7', NAME: 'Accounts & Admin', PARENT: '1' },
];

export const MOCK_USER_IDS = {
  minalDhote: '27',
  rahulWankhede: '31',
  sayaliBhoyar: '34',
  nikhilThakre: '38',
  poojaRaut: '42',
  akashMeshram: '45',
} as const;

export const MOCK_BITRIX_USERS: BitrixUser[] = [
  { ID: MOCK_USER_IDS.minalDhote, NAME: 'Minal', LAST_NAME: 'Dhote', UF_DEPARTMENT: [3], ACTIVE: true },
  { ID: MOCK_USER_IDS.rahulWankhede, NAME: 'Rahul', LAST_NAME: 'Wankhede', UF_DEPARTMENT: [3], ACTIVE: true },
  { ID: MOCK_USER_IDS.sayaliBhoyar, NAME: 'Sayali', LAST_NAME: 'Bhoyar', UF_DEPARTMENT: [3], ACTIVE: true },
  { ID: MOCK_USER_IDS.nikhilThakre, NAME: 'Nikhil', LAST_NAME: 'Thakre', UF_DEPARTMENT: [5], ACTIVE: true },
  { ID: MOCK_USER_IDS.poojaRaut, NAME: 'Pooja', LAST_NAME: 'Raut', UF_DEPARTMENT: [5], ACTIVE: true },
  { ID: MOCK_USER_IDS.akashMeshram, NAME: 'Akash', LAST_NAME: 'Meshram', UF_DEPARTMENT: [7], ACTIVE: true },
];

/** The person who books general (non-deal) demo expenses. */
export const MOCK_ADMIN_USER_ID = MOCK_USER_IDS.akashMeshram;

/** AVIRO's solar pipeline. Pipeline ID "0" is a placeholder. */
export const SOLAR_PIPELINE_ID = '0';

export const MOCK_BITRIX_DEAL_CATEGORIES: BitrixDealCategory[] = [
  { id: 0, name: 'Solar sales', sort: 100, isDefault: 'Y' },
];

/**
 * Stages of the Solar sales pipeline, in order.
 * Stage NAMES are from AVIRO's portal. Stage CODES (STATUS_ID) are placeholders.
 */
const SOLAR_STAGES: ReadonlyArray<readonly [code: string, name: string]> = [
  ['NEW', 'Site Survey & Feasibility Study'],
  ['UC_DESIGN', 'Final Design Approval Both Side'],
  ['UC_PORTAL', 'National Portal Application'],
  ['UC_LOAN', 'Loan Process'],
  ['UC_PVAPP', 'PV Application'],
  ['UC_PAY2', 'Payment 2nd Installment'],
  ['UC_PROCURE', 'Material Procurement'],
  ['UC_INSTALL', 'Plant Installation'],
  ['UC_PAY3', 'Payment 3rd Installment'],
  ['UC_NETMETER', 'Net metering documents preparation'],
  ['UC_SUBSIDY', 'Subsidy Process'],
  ['UC_CHARGE', 'Plant Charge Process'],
  ['UC_HANDOVER', 'Handover & Training'],
  ['UC_INVOICE', 'Invoicing and Accounting'],
  ['WON', 'Close deal'],
];

export const MOCK_BITRIX_DEAL_STAGES: BitrixDealStage[] = SOLAR_STAGES.map(([code, name], index) => ({
  ENTITY_ID: 'DEAL_STAGE',
  STATUS_ID: code,
  NAME: name,
  SORT: String((index + 1) * 10),
  CATEGORY_ID: SOLAR_PIPELINE_ID,
}));

/** Stage codes in pipeline order (index 0 = first stage). */
export const SOLAR_STAGE_CODES: readonly string[] = SOLAR_STAGES.map(([code]) => code);

/** The final, successful stage. */
export const SOLAR_WON_STAGE_CODE = 'WON';
