import { addDays, differenceInCalendarDays, formatISO, parseISO, subDays } from 'date-fns';
import { DEAL_CUSTOM_FIELDS } from '../../config/finance';
import type { BitrixDeal } from '../../types/bitrix';
import {
  MOCK_USER_IDS,
  SOLAR_PIPELINE_ID,
  SOLAR_STAGE_CODES,
  SOLAR_WON_STAGE_CODE,
} from './bitrixDirectory';
import { MOCK_TODAY } from './mockClock';
import { createSeededRandom, type SeededRandom } from './random';

/**
 * MOCK AVIRO solar deals in raw Bitrix24 `crm.deal.list` format.
 *
 * - Deal #13088 "Simple Park Co-op Society" uses the real values we inspected
 *   (name, ID, pipeline, stage, responsible person, amount, start date, site name).
 *   Project Type, Plant Capacity and Lead Category are left empty because we
 *   have not seen them yet.
 * - Every other deal is generated demo data.
 */

type ProjectType = 'Residential' | 'Housing Society' | 'Commercial' | 'Industrial';

interface ProjectProfile {
  type: ProjectType;
  weight: number;
  minKw: number;
  maxKw: number;
  /** Price per kW in rupees. */
  minRate: number;
  maxRate: number;
  /** Typical days from start to "Close deal". */
  typicalDays: number;
  responsibleIds: readonly string[];
}

const PROFILES: readonly ProjectProfile[] = [
  {
    type: 'Residential', weight: 0.45, minKw: 3, maxKw: 10, minRate: 58_000, maxRate: 68_000,
    typicalDays: 75, responsibleIds: [MOCK_USER_IDS.minalDhote, MOCK_USER_IDS.rahulWankhede, MOCK_USER_IDS.sayaliBhoyar],
  },
  {
    type: 'Housing Society', weight: 0.25, minKw: 10, maxKw: 50, minRate: 48_000, maxRate: 56_000,
    typicalDays: 130, responsibleIds: [MOCK_USER_IDS.minalDhote, MOCK_USER_IDS.sayaliBhoyar],
  },
  {
    type: 'Commercial', weight: 0.2, minKw: 15, maxKw: 100, minRate: 42_000, maxRate: 50_000,
    typicalDays: 140, responsibleIds: [MOCK_USER_IDS.nikhilThakre, MOCK_USER_IDS.poojaRaut],
  },
  {
    type: 'Industrial', weight: 0.1, minKw: 50, maxKw: 300, minRate: 36_000, maxRate: 44_000,
    typicalDays: 190, responsibleIds: [MOCK_USER_IDS.nikhilThakre, MOCK_USER_IDS.poojaRaut],
  },
];

const FIRST_NAMES = ['Prakash', 'Sunita', 'Anil', 'Vaishali', 'Ramesh', 'Kavita', 'Sanjay', 'Meena', 'Vijay', 'Shubhangi', 'Deepak', 'Asha', 'Mahesh', 'Rekha', 'Ganesh', 'Swati'] as const;
const LAST_NAMES = ['Gawande', 'Deshmukh', 'Kale', 'Patil', 'Ingole', 'Chaudhari', 'Bhagat', 'Kulkarni', 'Shende', 'Jadhav', 'Pawar', 'Mohod'] as const;
const SOCIETY_NAMES = ['Green Meadows', 'Shanti Niketan', 'Sai Sparsh', 'Gokul Dham', 'Om Shree Residency', 'Laxmi Nagar', 'Royal Palms', 'Silver Oak', 'Sunrise Heights', 'Pride Park', 'Kalpataru Enclave', 'Anand Vihar', 'Tulsi Vrindavan', 'Swami Samarth'] as const;
const SOCIETY_SUFFIXES = ['Co-op Society', 'Co-op Housing Society', 'CHS Ltd'] as const;
const COMMERCIAL_NAMES = ['Hotel Sai Palace', 'Shree Krishna Traders', 'Om Sai Hospital', 'City Care Clinic', 'Mauli Cold Storage', 'Balaji Supermart', 'Sanskar International School', 'Hotel Rajdhani', 'Vishwa Automobiles', 'Gajanan Petrol Pump', 'Aarogya Diagnostic Centre', 'Siddhivinayak Banquet Hall', 'Sunshine Public School', 'Kamdhenu Dairy'] as const;
const INDUSTRIAL_NAMES = ['Vidarbha Agro Industries Pvt Ltd', 'Maha Plast Polymers', 'Shreeji Cotton Ginning', 'Sahyadri Steel Fabricators', 'Deccan Packaging Pvt Ltd', 'Orange City Food Products', 'Varad Engineering Works', 'Sai Rice Mill'] as const;
const LOCALITIES = ['Wardha Road, Nagpur', 'Manish Nagar, Nagpur', 'Hingna, Nagpur', 'Butibori MIDC, Nagpur', 'Amravati Road, Nagpur', 'Wagholi, Pune', 'Kharadi, Pune', 'Hadapsar, Pune', 'Ambad MIDC, Nashik', 'Gangapur Road, Nashik', 'Chandrapur', 'Wardha', 'Amravati', 'Akola'] as const;
/** Placeholder values; replace with AVIRO's real Lead Category options. */
const LEAD_CATEGORIES = ['Referral', 'Website', 'Channel Partner', 'Walk-in', 'Social Media'] as const;

const GENERATED_DEAL_COUNT = 60;
const OLDEST_START_DAYS_AGO = 450;

export interface MockDealSeed {
  deal: BitrixDeal;
  /** Index of the current stage in SOLAR_STAGE_CODES (used by the demo expense generator). */
  stageIndex: number;
  /** Typical project length in days (used by the demo expense generator). */
  typicalDays: number;
}

function pickWeighted(random: SeededRandom, profiles: readonly ProjectProfile[]): ProjectProfile {
  let roll = random.next();
  for (const profile of profiles) {
    roll -= profile.weight;
    if (roll <= 0) return profile;
  }
  return profiles[profiles.length - 1];
}

function uniqueName(used: Set<string>, build: () => string): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const name = build();
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `${build()} (${used.size + 1})`;
  used.add(fallback);
  return fallback;
}

function dealName(random: SeededRandom, type: ProjectType, used: Set<string>): string {
  return uniqueName(used, () => {
    switch (type) {
      case 'Residential':
        return `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
      case 'Housing Society':
        return `${random.pick(SOCIETY_NAMES)} ${random.pick(SOCIETY_SUFFIXES)}`;
      case 'Commercial':
        return random.pick(COMMERCIAL_NAMES);
      case 'Industrial':
        return random.pick(INDUSTRIAL_NAMES);
    }
  });
}

/** Older deals are usually further along the pipeline. */
function stageIndexFor(random: SeededRandom, ageDays: number, typicalDays: number): number {
  const lastIndex = SOLAR_STAGE_CODES.length - 1;
  const progress = ageDays / typicalDays + random.between(-0.2, 0.1);
  return Math.min(lastIndex, Math.max(0, Math.floor(progress * lastIndex)));
}

function toRawDeal(params: {
  id: string;
  title: string;
  amount: number;
  /** Total Project Cost; `null` = not filled in. */
  projectCost: number | null;
  stageIndex: number;
  responsibleId: string;
  startDate: Date;
  siteName: string | null;
  projectType: string | null;
  plantCapacityKw: number | null;
  leadCategory: string | null;
}): BitrixDeal {
  const stageCode = SOLAR_STAGE_CODES[params.stageIndex];
  return {
    ID: params.id,
    TITLE: params.title,
    OPPORTUNITY: params.amount.toFixed(2),
    CURRENCY_ID: 'INR',
    CATEGORY_ID: SOLAR_PIPELINE_ID,
    STAGE_ID: stageCode,
    STAGE_SEMANTIC_ID: stageCode === SOLAR_WON_STAGE_CODE ? 'S' : 'P',
    ASSIGNED_BY_ID: params.responsibleId,
    BEGINDATE: formatISO(params.startDate),
    DATE_CREATE: formatISO(params.startDate),
    [DEAL_CUSTOM_FIELDS.siteName]: params.siteName,
    [DEAL_CUSTOM_FIELDS.projectType]: params.projectType,
    [DEAL_CUSTOM_FIELDS.plantCapacityKw]: params.plantCapacityKw === null ? null : String(params.plantCapacityKw),
    [DEAL_CUSTOM_FIELDS.leadCategory]: params.leadCategory,
    [DEAL_CUSTOM_FIELDS.totalProjectCost]: params.projectCost === null ? '' : `${params.projectCost}|INR`,
  };
}

/** The real deal inspected in AVIRO's portal. */
function referenceDealSeed(): MockDealSeed {
  return {
    stageIndex: 0, // Site Survey & Feasibility Study
    typicalDays: 130,
    deal: toRawDeal({
      id: '13088',
      title: 'Simple Park Co-op Society',
      amount: 1_148_364,
      projectCost: null, // not filled in on the real deal
      stageIndex: 0,
      responsibleId: MOCK_USER_IDS.minalDhote,
      startDate: new Date(2026, 8, 9), // 09 Sep 2026, as seen on the real deal
      siteName: 'Simple Park Co-op Society',
      projectType: null,
      plantCapacityKw: null,
      leadCategory: null,
    }),
  };
}

function generateDealSeeds(): MockDealSeed[] {
  const random = createSeededRandom(13088);
  const usedNames = new Set<string>(['Simple Park Co-op Society']);

  // Start dates first, oldest to newest, so older deals get lower IDs (as in Bitrix24).
  const startDates = Array.from({ length: GENERATED_DEAL_COUNT }, () =>
    subDays(MOCK_TODAY, random.int(12, OLDEST_START_DAYS_AGO)),
  ).sort((a, b) => a.getTime() - b.getTime());

  let nextId = 12_400;
  const seeds = startDates.map((startDate): MockDealSeed => {
    const profile = pickWeighted(random, PROFILES);
    const capacity = random.int(profile.minKw, profile.maxKw);
    const amount = Math.round(capacity * random.between(profile.minRate, profile.maxRate));
    const ageDays = differenceInCalendarDays(MOCK_TODAY, startDate);
    const stageIndex = stageIndexFor(random, ageDays, profile.typicalDays);

    const seed: MockDealSeed = {
      stageIndex,
      typicalDays: profile.typicalDays,
      deal: toRawDeal({
        id: String(nextId),
        title: dealName(random, profile.type, usedNames),
        amount,
        // Every 4th deal has no Total Project Cost, to show "—". Not drawn from `random`, so the other mock values stay the same.
        projectCost: nextId % 4 === 0 ? null : amount,
        stageIndex,
        responsibleId: random.pick(profile.responsibleIds),
        startDate,
        siteName: random.pick(LOCALITIES),
        projectType: profile.type,
        plantCapacityKw: capacity,
        leadCategory: random.pick(LEAD_CATEGORIES),
      }),
    };
    nextId += random.int(3, 10);
    return seed;
  });

  return [...seeds, referenceDealSeed()];
}

export const MOCK_DEAL_SEEDS: MockDealSeed[] = generateDealSeeds();

export const MOCK_BITRIX_DEALS: BitrixDeal[] = MOCK_DEAL_SEEDS.map((seed) => seed.deal);

/** Used by the demo expense generator to place costs on a timeline. */
export function expectedStageDate(seed: MockDealSeed, stageIndex: number): Date {
  const lastIndex = SOLAR_STAGE_CODES.length - 1;
  const start = parseISO(seed.deal.BEGINDATE);
  return addDays(start, Math.round((stageIndex / lastIndex) * seed.typicalDays));
}
