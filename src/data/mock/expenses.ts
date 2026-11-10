import { addDays, isAfter, parseISO, setDate, startOfMonth, subMonths } from 'date-fns';
import { DEAL_CUSTOM_FIELDS } from '../../config/finance';
/** A demo expense in a simple shape; mockFinanceDataSource turns it into a raw Bitrix24 "Expenses" item. */
export interface MockExpense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  /** Text of the Expenses smart process "Expense Category" field. */
  category: string;
  date: Date;
  employeeId: string;
  departmentId: string | null;
  siteName: string | null;
  dealId: string | null;
}
import { expectedStageDate, MOCK_DEAL_SEEDS } from './bitrixDeals';
import { MOCK_ADMIN_USER_ID, MOCK_BITRIX_USERS } from './bitrixDirectory';
import { MOCK_TODAY } from './mockClock';
import { createSeededRandom, type SeededRandom } from './random';

/**
 * ⚠️ DEMO EXPENSES — NOT REAL AVIRO DATA.
 *
 * AVIRO's Expense Smart Process does not exist yet (Step 3), so every
 * expense here is invented only to test the Net Revenue calculations.
 * They are written in a simple `MockExpense` shape. A mapper for
 * the real SPA fields will be added in Step 3.
 */

interface CostComponent {
  /** Expense appears once the deal reaches this stage index (0 = Site Survey). */
  fromStage: number;
  category: string;
  /** Share of the deal amount this cost usually represents. */
  share: number;
  titles: readonly string[];
}

/** Typical solar project cost build-up. Stage indexes follow SOLAR_STAGE_CODES. */
const COST_COMPONENTS: readonly CostComponent[] = [
  { fromStage: 0, category: 'Site', share: 0.004, titles: ['Site survey visit', 'Shadow analysis'] },
  { fromStage: 0, category: 'Transportation', share: 0.002, titles: ['Survey travel'] },
  { fromStage: 2, category: 'Other', share: 0.008, titles: ['Documentation charges', 'Portal registration charges'] },
  { fromStage: 6, category: 'Material Purchase', share: 0.4, titles: ['Solar PV modules'] },
  { fromStage: 6, category: 'Material Purchase', share: 0.14, titles: ['Solar inverter'] },
  { fromStage: 6, category: 'Material Purchase', share: 0.1, titles: ['Mounting structure', 'DC/AC cables & DCDB/ACDB', 'Earthing & lightning arrester kit'] },
  { fromStage: 6, category: 'Transportation', share: 0.035, titles: ['Material transport to site'] },
  { fromStage: 7, category: 'Manpower', share: 0.14, titles: ['Installation labour', 'Electrician charges'] },
  { fromStage: 7, category: 'Site', share: 0.07, titles: ['Civil & structure foundation work', 'Site safety & scaffolding'] },
  { fromStage: 9, category: 'Other', share: 0.02, titles: ['Net meter & testing charges', 'DISCOM inspection fees'] },
  { fromStage: 12, category: 'Manpower', share: 0.02, titles: ['Commissioning & handover visit'] },
];

const departmentByUserId = new Map(
  MOCK_BITRIX_USERS.map((user) => [user.ID, user.UF_DEPARTMENT?.length ? String(user.UF_DEPARTMENT[0]) : null]),
);

function generateDealExpenses(random: SeededRandom): MockExpense[] {
  const expenses: MockExpense[] = [];
  let counter = 1;

  for (const seed of MOCK_DEAL_SEEDS) {
    const { deal, stageIndex } = seed;
    const amount = Number(deal.OPPORTUNITY);
    const startDate = parseISO(deal.BEGINDATE);
    // Most projects keep costs at ~75-85% of the deal amount; a few overrun.
    const costFactor = random.chance(0.08) ? random.between(1.05, 1.15) : random.between(0.8, 0.92);

    for (const component of COST_COMPONENTS) {
      if (stageIndex < component.fromStage) continue;

      let date = addDays(expectedStageDate(seed, component.fromStage), random.int(0, 7));
      if (date < startDate) date = startDate;
      if (isAfter(date, MOCK_TODAY)) date = MOCK_TODAY;

      expenses.push({
        id: `DEMO-EXP-${String(counter).padStart(4, '0')}`,
        title: random.pick(component.titles),
        amount: Math.round(amount * component.share * costFactor * random.between(0.9, 1.1)),
        currency: 'INR',
        category: component.category,
        date,
        employeeId: deal.ASSIGNED_BY_ID,
        departmentId: departmentByUserId.get(deal.ASSIGNED_BY_ID) ?? null,
        siteName: String(deal[DEAL_CUSTOM_FIELDS.siteName] ?? deal.TITLE),
        dealId: deal.ID,
      });
      counter += 1;
    }
  }

  return expenses;
}

/** Monthly office overheads that are not linked to any deal. */
function generateGeneralExpenses(random: SeededRandom): MockExpense[] {
  const expenses: MockExpense[] = [];
  const departmentId = departmentByUserId.get(MOCK_ADMIN_USER_ID) ?? null;

  for (let monthsAgo = 15; monthsAgo >= 0; monthsAgo -= 1) {
    const month = startOfMonth(subMonths(MOCK_TODAY, monthsAgo));
    const items: ReadonlyArray<{ title: string; day: number; amount: number }> = [
      { title: 'Office rent', day: 5, amount: 65_000 },
      { title: 'Software subscriptions', day: 10, amount: Math.round(random.between(9_000, 14_000)) },
      { title: 'Office utilities', day: 18, amount: Math.round(random.between(7_000, 12_000)) },
    ];

    items.forEach((item, index) => {
      const date = setDate(month, item.day);
      if (isAfter(date, MOCK_TODAY)) return;
      expenses.push({
        id: `DEMO-GEN-${month.getFullYear()}${String(month.getMonth() + 1).padStart(2, '0')}-${index + 1}`,
        title: item.title,
        amount: item.amount,
        currency: 'INR',
        category: 'Administration',
        date,
        employeeId: MOCK_ADMIN_USER_ID,
        departmentId,
        siteName: null,
        dealId: null,
      });
    });
  }

  return expenses;
}

function generateExpenses(): MockExpense[] {
  const random = createSeededRandom(4417);
  return [...generateDealExpenses(random), ...generateGeneralExpenses(random)];
}

export const MOCK_EXPENSES: MockExpense[] = generateExpenses();
