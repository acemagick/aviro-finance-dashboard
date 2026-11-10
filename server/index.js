import 'dotenv/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzip } from 'node:zlib';
import express from 'express';
import { createCache } from './cache.js';

/**
 * AVIRO Finance API — the only place that talks to Bitrix24.
 *
 * The webhook URL is a secret: it is read from the environment (or .env
 * locally) here and never sent to the browser. The browser only calls the
 * /api/* endpoints below. In production this server also serves the built
 * dashboard (dist/), so the whole app runs as one web service.
 */

const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Production hosts (e.g. Render) route traffic from outside, so listen on all interfaces there;
// locally, stay private to this computer.
const HOST = process.env.HOST || (IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1');
const PORT = Number(process.env.PORT) || 3001;

const webhookUrl = process.env.BITRIX_WEBHOOK_URL;

if (!webhookUrl) {
  throw new Error('BITRIX_WEBHOOK_URL is missing (set it in .env locally, or as an environment variable in production)');
}

// ---------------------------------------------------------------------------
// Login (HTTP Basic Auth) — required in production for the dashboard AND the API.
// The username and password come only from the environment; they are never
// sent to the browser, logged, or stored in the code.
// ---------------------------------------------------------------------------

const DASHBOARD_USERNAME = process.env.DASHBOARD_USERNAME;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

if (IS_PRODUCTION && (!DASHBOARD_USERNAME || !DASHBOARD_PASSWORD)) {
  // Refuse to start rather than serve AVIRO's finance data without a login.
  throw new Error('DASHBOARD_USERNAME and DASHBOARD_PASSWORD must be set in production');
}

/** Compares two strings in constant time (hashing first makes the lengths equal). */
function safeEqual(a, b) {
  const hash = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

function isAuthorized(header) {
  const [scheme, encoded] = (header ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return false;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  // Check both, always, so the response time does not reveal which one was wrong.
  const userOk = safeEqual(decoded.slice(0, separator), DASHBOARD_USERNAME);
  const passwordOk = safeEqual(decoded.slice(separator + 1), DASHBOARD_PASSWORD);
  return userOk && passwordOk;
}

if (IS_PRODUCTION) {
  app.use((req, res, next) => {
    if (isAuthorized(req.headers.authorization)) return next();
    res.set('WWW-Authenticate', 'Basic realm="AVIRO Finance Dashboard", charset="UTF-8"');
    res.status(401).send('Authentication required.');
  });
}

/** JSON bodies smaller than this are sent as they are (compressing them gains nothing). */
const COMPRESS_MIN_BYTES = 1024;

/**
 * API responses:
 * - gzip-compressed when the browser accepts it (the deals and Essentials only lists are ~7 MB
 *   of JSON, ~0.3 MB compressed). The JSON is exactly the same as without compression.
 * - "X-Cache-Expires-In": milliseconds until the oldest cached Bitrix24 data expires (0 when it
 *   is not cached), so the browser can reuse a dataset exactly as long as this server would
 *   serve the same data — never longer.
 */
app.use('/api', (req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    res.set('X-Cache-Expires-In', String(cacheExpiresIn()));
    res.vary('Accept-Encoding');
    const text = JSON.stringify(body);
    if (text === undefined || Buffer.byteLength(text) < COMPRESS_MIN_BYTES || !/\bgzip\b/i.test(req.headers['accept-encoding'] ?? '')) {
      return sendJson(body);
    }
    gzip(text, (error, compressed) => {
      if (error) return sendJson(body);
      res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'gzip' }).send(compressed);
    });
    return res;
  };
  next();
});

// ---------------------------------------------------------------------------
// Bitrix24 field codes (verified against crm.deal.fields / crm.item.fields).
// Keep in sync with DEAL_CUSTOM_FIELDS / EXPENSE_FIELDS in src/config/finance.ts.
// ---------------------------------------------------------------------------

const DEAL_CUSTOM_FIELDS = [
  'UF_CRM_6911972A7FFDB', // Site Name (string, multiple)
  'UF_CRM_68B1565B081A1', // Type of Project (list: DCR / NON DCR)
  'UF_CRM_69141F2229AB2', // Required Plant Capacity (Kwp) (string, e.g. "40 kwp")
  'UF_CRM_68B92E527B456', // Lead Category (list, multiple)
  'UF_CRM_6A71CB860E243', // Total Project Cost (money, "2000000|INR") — Income Dashboard only
];

// Installments 1–7: amount (money) + "Date of … Payment Received" (date).
// Keep in sync with DEAL_INSTALLMENT_FIELDS in src/config/finance.ts.
const DEAL_INSTALLMENT_FIELDS = [
  'UF_CRM_69044E5DA4CB6', 'UF_CRM_69044E5DC59B3', // 1st
  'UF_CRM_69044E5DB52CC', 'UF_CRM_69044E5DD5D03', // 2nd (amount allows several values)
  'UF_CRM_69044E5E07F93', 'UF_CRM_69044E5DECBE9', // 3rd
  'UF_CRM_69B151FB1FFA0', 'UF_CRM_69B151FAEE59B', // 4th
  'UF_CRM_69B151FB74D81', 'UF_CRM_69B151FB591A8', // 5th
  'UF_CRM_69B151FC00994', 'UF_CRM_69B151FBABDB8', // 6th
  'UF_CRM_69B151FC54F33', 'UF_CRM_69B151FC33121', // 7th
];

const DEAL_SELECT = [
  'ID',
  'TITLE',
  'OPPORTUNITY',
  'CURRENCY_ID',
  'CATEGORY_ID',
  'STAGE_ID',
  'STAGE_SEMANTIC_ID',
  'ASSIGNED_BY_ID',
  'BEGINDATE',
  'DATE_CREATE',
  ...DEAL_CUSTOM_FIELDS,
  ...DEAL_INSTALLMENT_FIELDS,
];

/** The "Expenses" smart process (crm.type.list). */
const EXPENSES_ENTITY_TYPE_ID = 1048;

const EXPENSE_FIELDS = {
  amount: 'ufCrm12_1790320689', // Expense Amount (money, "1500|INR")
  category: 'ufCrm12_1790320851', // Expense Category (list)
  dealLink: 'ufCrm12_1790320964', // Deal / Project (CRM link)
  employee: 'ufCrm12_1790708101', // Employee Name (employee → user ID)
  department: 'ufCrm12_1790709292', // Department (company structure section → department ID)
  siteName: 'ufCrm12_1790710037', // Site Name (string)
  expenseDate: 'ufCrm12_1790710158', // Expense Date (date)
};

const EXPENSE_SELECT = ['id', 'title', 'assignedById', 'createdTime', ...Object.values(EXPENSE_FIELDS)];

/**
 * The "Essentials only" smart process: AVIRO's request forms (expense claims, vendor invoices, ...).
 * Its Category field is the dashboard's expense Category. Which categories count as expenses, and
 * which amount/date/site field each one uses, is decided in ESSENTIALS_CATEGORY_RULES in
 * src/config/finance.ts. Keep ESSENTIALS_FIELDS in sync with the fields used there.
 */
const ESSENTIALS_ENTITY_TYPE_ID = 1040;

const ESSENTIALS_FIELDS = {
  category: 'ufCrm8_1776449281117', // Category (list)
  dealLink: 'parentId2', // Deal (CRM relation)
  expensesBillAmount: 'ufCrm8_1777130032977', // Expenses Bill Amount (money)
  expensesBillDate: 'ufCrm8_1777129155784', // Expenses Bill Date (date)
  expensesSiteName: 'ufCrm8_1777130814106', // Site Name for Expenses (string)
  totalInvoiceAmount: 'ufCrm8_1776509508863', // Total Invoice Amount (money)
  vendorBillDate: 'ufCrm8_1776448970791', // Date of Vendor Bill (date)
  expensesEmployee: 'ufCrm8_1777129341560', // Employee Name (list of typed names)
  expensesDepartment: 'ufCrm8_1777130112267', // Expenses Bill Department (list)
  vendorDepartment: 'ufCrm8_1776449169791', // Vendor Billing to Department (list)
  advanceAmount: 'ufCrm8_1777341966066', // Total Amount Final with the Vendor Incl Tax (money; information only)
  purchaseTotal: 'ufCrm8_1778196648665', // Total Amount (money; information only)
  // Shown (not counted) records: amounts, dates, employee, department and site per Category.
  collectionAmount: 'ufCrm8_1778143429957', // Cheque/Cash/Online Payment Amount (money)
  collectionDate: 'ufCrm8_1778143592355', // its date
  amountCollected: 'ufCrm8_1778140937679', // Amount Collected (money)
  amountCollectedDate: 'ufCrm8_1778141019040', // its date
  responsiblePerson: 'ufCrm8_1778141185952', // Responsible Person (list of typed names)
  collectionDepartment: 'ufCrm8_1778140768705', // Payment Collection department (list)
  collectionSiteName: 'ufCrm8_1788187810912', // Site Name/Customer Name (string)
  requisitionSiteName: 'ufCrm8_1786693673017', // Material Requisition site name (string)
  purchaseInvoiceDate: 'ufCrm8_1778196408860', // Tax Invoice/PI Date (date)
  purchaseDepartment: 'ufCrm8_1778195902330', // Material Purchase department (list)
  purchaseSiteName: 'ufCrm8_1788247302195', // Material Purchase site name (string)
  purchaseInvoiceType: 'ufCrm8_1778196279862', // Type of Invoice (list: Proforma / Tax)
};

const ESSENTIALS_SELECT = ['id', 'title', 'stageId', 'createdTime', 'assignedById', ...Object.values(ESSENTIALS_FIELDS)];

// ---------------------------------------------------------------------------
// Bitrix24 REST helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;
/** Bitrix24 allows at most 50 commands in one batch call. */
const BATCH_LIMIT = 50;
const MAX_RETRIES = 3;

class BitrixError extends Error {}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls one Bitrix24 REST method. Retries when Bitrix24 asks us to slow down. */
async function bitrixRequest(method, params = {}, attempt = 1) {
  const response = await fetch(new URL(`${method}.json`, webhookUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => null);

  if (data?.error === 'QUERY_LIMIT_EXCEEDED' || response.status === 503) {
    if (attempt < MAX_RETRIES) {
      await wait(1000 * attempt);
      return bitrixRequest(method, params, attempt + 1);
    }
  }

  if (!response.ok || !data || data.error) {
    throw new BitrixError(`${method} failed: HTTP ${response.status} ${data?.error ?? ''} ${data?.error_description ?? ''}`.trim());
  }

  return data;
}

/** Encodes params the way Bitrix24 expects inside a batch command (PHP-style: a[b][0]=c). */
function toQuery(params, prefix = '') {
  return Object.entries(params)
    .flatMap(([key, value]) => {
      const name = prefix ? `${prefix}[${encodeURIComponent(key)}]` : encodeURIComponent(key);
      if (value !== null && typeof value === 'object') return [toQuery(value, name)];
      return [`${name}=${encodeURIComponent(value ?? '')}`];
    })
    .filter(Boolean)
    .join('&');
}

/** Runs up to 50 commands in one `batch` call; returns { commandKey: result }. */
async function bitrixBatch(cmd) {
  const data = await bitrixRequest('batch', { halt: 1, cmd });
  const errors = data.result?.result_error ?? {};

  if (!Array.isArray(errors) && Object.keys(errors).length > 0) {
    throw new BitrixError(`batch failed: ${JSON.stringify(errors)}`);
  }

  return data.result.result;
}

/**
 * Fetches every page of a Bitrix24 list method (for small lists: users,
 * departments, pipelines, stages).
 *
 * The first page tells us the total; the remaining pages are requested
 * through `batch` (up to 50 pages per call) instead of one call per page.
 * `pick` extracts the array of records from a page's `result`.
 */
async function bitrixListAll(method, params = {}, pick = (result) => result) {
  const first = await bitrixRequest(method, { ...params, start: 0 });
  const records = [...(pick(first.result) ?? [])];

  if (first.next === undefined) return records;

  const total = Number(first.total) || 0;
  const starts = [];
  for (let start = Number(first.next); start < total; start += PAGE_SIZE) starts.push(start);

  for (let i = 0; i < starts.length; i += BATCH_LIMIT) {
    const chunk = starts.slice(i, i + BATCH_LIMIT);
    const results = await bitrixBatch(Object.fromEntries(chunk.map((start) => [`p${start}`, `${method}?${toQuery({ ...params, start })}`])));
    for (const start of chunk) records.push(...(pick(results[`p${start}`]) ?? []));
  }

  return records;
}

/** How many `batch` calls may run at the same time (Bitrix24 allows short bursts). */
const BATCH_CONCURRENCY = 4;
/** Aim for ~70% full ID ranges, so most ranges need exactly one command. */
const RANGE_FILL = 0.7;

/**
 * Fast full export for large lists (deals, expenses).
 *
 * Offset paging (start=50, 100, ...) makes Bitrix24 count all records and
 * skip rows on every page, which is what made the first load take ~26 s.
 * Instead, the ID span is split into ranges sized to hold ~35 records each,
 * and each range is fetched with `start=-1` (no count, no offset). Ranges are
 * sent 50 per `batch`, several batches in parallel. A range that comes back
 * full (50 rows) may hold more, so it continues after its last ID until a
 * range returns fewer than 50 rows. Every record is therefore fetched exactly
 * once, whatever the ID distribution.
 *
 * Bitrix24 runs the commands of one batch one after another, so for slower methods
 * a smaller `batchSize` spreads the ranges over more batches that run in parallel.
 */
async function bitrixListAllById(method, params, { idField, pick = (result) => result, batchSize = BATCH_LIMIT }) {
  const { filter = {}, ...rest } = params;
  const idOf = (record) => Number(record[idField]);

  // Lowest ID + total count, and highest ID, in parallel.
  const [lowest, highest] = await Promise.all([
    bitrixRequest(method, { ...rest, filter, select: [idField], order: { [idField]: 'ASC' }, start: 0 }),
    bitrixRequest(method, { ...rest, filter, select: [idField], order: { [idField]: 'DESC' }, start: -1 }),
  ]);
  const minId = idOf(pick(lowest.result)?.[0] ?? {});
  const maxId = idOf(pick(highest.result)?.[0] ?? {});
  const total = Number(lowest.total) || 0;
  if (!Number.isFinite(minId) || !Number.isFinite(maxId) || total === 0) return [];

  const span = maxId - minId + 1;
  const rangeSize = Math.max(1, Math.floor((PAGE_SIZE * RANGE_FILL * span) / total));
  let ranges = [];
  for (let from = minId; from <= maxId; from += rangeSize) ranges.push({ from, to: Math.min(from + rangeSize, maxId + 1) });

  const records = new Map();
  const command = ({ from, to }) =>
    `${method}?${toQuery({
      ...rest,
      filter: { ...filter, [`>=${idField}`]: from, [`<${idField}`]: to },
      order: { [idField]: 'ASC' },
      start: -1,
    })}`;

  while (ranges.length > 0) {
    const chunks = [];
    for (let i = 0; i < ranges.length; i += batchSize) chunks.push(ranges.slice(i, i + batchSize));
    const next = [];

    for (let i = 0; i < chunks.length; i += BATCH_CONCURRENCY) {
      const group = chunks.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.all(group.map((chunk) => bitrixBatch(Object.fromEntries(chunk.map((range, j) => [`r${j}`, command(range)])))));

      group.forEach((chunk, g) => {
        chunk.forEach((range, j) => {
          const rows = pick(results[g][`r${j}`]) ?? [];
          for (const row of rows) records.set(idOf(row), row);
          if (rows.length >= PAGE_SIZE) next.push({ from: idOf(rows[rows.length - 1]) + 1, to: range.to });
        });
      });
    }

    ranges = next;
  }

  return [...records.values()].sort((a, b) => idOf(a) - idOf(b));
}

// ---------------------------------------------------------------------------
// Caching: Bitrix24 is slow and rate-limited, so results are kept for 5 min.
// Parallel requests for the same data share one Bitrix24 fetch.
// Between 5 and 30 min old, the cached data is still answered at once while ONE fresh
// fetch runs in the background (the next request gets the fresh data). Older than
// 30 min, the request waits for fresh data, as before. See server/cache.js.
// POST /api/refresh clears the cache on demand (see refreshAll below).
// ---------------------------------------------------------------------------

const CACHE_TTL = 5 * 60 * 1000;
/** Cached data older than this is never answered; the request waits for a fresh fetch. */
const CACHE_MAX_STALE = 30 * 60 * 1000;
const cache = createCache({ ttl: CACHE_TTL, maxStale: CACHE_MAX_STALE });
const cached = cache.cached;
const cacheExpiresIn = cache.expiresIn;

/** Wraps a route: logs the real error on the server, sends only a generic message to the browser. */
function route(label, handler) {
  return async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (error) {
      console.error(`${label} ERROR:`, error instanceof Error ? error.message : error);
      res.status(502).json({ error: `Could not load ${label} from Bitrix24.` });
    }
  };
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

const loadDeals = () => cached('deals', () => bitrixListAllById('crm.deal.list', { select: DEAL_SELECT }, { idField: 'ID' }));

const loadDealFields = () => cached('deal-fields', async () => (await bitrixRequest('crm.deal.fields')).result);

const loadExpenseFields = () =>
  cached('expense-fields', async () => (await bitrixRequest('crm.item.fields', { entityTypeId: EXPENSES_ENTITY_TYPE_ID })).result.fields);

const loadExpenses = () =>
  cached('expenses', () =>
    bitrixListAllById(
      'crm.item.list',
      { entityTypeId: EXPENSES_ENTITY_TYPE_ID, select: EXPENSE_SELECT },
      { idField: 'id', pick: (result) => result?.items },
    ),
  );

const loadEssentialsFields = () =>
  cached('essentials-fields', async () => (await bitrixRequest('crm.item.fields', { entityTypeId: ESSENTIALS_ENTITY_TYPE_ID })).result.fields);

const loadEssentials = () =>
  cached('essentials', () =>
    bitrixListAllById(
      'crm.item.list',
      { entityTypeId: ESSENTIALS_ENTITY_TYPE_ID, select: ESSENTIALS_SELECT },
      // crm.item.list on this process takes ~0.1 s per command: 4 smaller batches in parallel instead of 2 full ones.
      { idField: 'id', pick: (result) => result?.items, batchSize: 25 },
    ),
  );

// Company employees only: extranet (external) users would otherwise be included when the
// webhook's owner can see them, and could share a name with an employee.
const loadUsers = () => cached('users', () => bitrixListAll('user.get', { filter: { USER_TYPE: 'employee' } }));
const loadDepartments = () => cached('departments', () => bitrixListAll('department.get', {}));
const loadDealCategories = () =>
  cached('deal-categories', () => bitrixListAll('crm.category.list', { entityTypeId: 2 }, (result) => result?.categories));
const loadStatuses = () => cached('statuses', () => bitrixListAll('crm.status.list', {}));

/** { optionId: optionText } for a Bitrix24 list (enumeration) field. */
function optionsOf(field) {
  return Object.fromEntries((field?.items ?? []).map((item) => [String(item.ID), item.VALUE]));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Developer tools only (raw Bitrix24 records and field definitions); the dashboard does not use them.
// Not available in production, where they fall through to the JSON 404 below.
if (!IS_PRODUCTION) {
  app.get(
    '/api/deal/:id',
    route('deal', async (req) => bitrixRequest('crm.deal.get', { id: req.params.id })),
  );

  app.get('/api/deal-fields', route('deal fields', loadDealFields));
}

app.get(
  '/api/real-deals',
  route('deals', async () => {
    const deals = await loadDeals();
    return { total: deals.length, deals };
  }),
);

app.get(
  '/api/users',
  route('users', async () => {
    const users = await loadUsers();
    // Only the fields the dashboard needs — no emails, phones, etc.
    return {
      users: users.map((user) => ({
        ID: String(user.ID),
        NAME: user.NAME ?? '',
        LAST_NAME: user.LAST_NAME ?? '',
        UF_DEPARTMENT: Array.isArray(user.UF_DEPARTMENT) ? user.UF_DEPARTMENT : [],
        ACTIVE: user.ACTIVE === true || user.ACTIVE === 'Y',
      })),
    };
  }),
);

app.get(
  '/api/departments',
  route('departments', async () => {
    const departments = await loadDepartments();
    return {
      departments: departments.map((department) => ({
        ID: String(department.ID),
        NAME: department.NAME ?? '',
        PARENT: department.PARENT === undefined ? undefined : String(department.PARENT),
      })),
    };
  }),
);

app.get(
  '/api/deal-categories',
  route('deal pipelines', async () => ({
    categories: await loadDealCategories(),
  })),
);

app.get(
  '/api/deal-stages',
  route('deal stages', async () => {
    // Stages of the default pipeline are "DEAL_STAGE"; other pipelines are "DEAL_STAGE_<pipelineId>".
    const statuses = await loadStatuses();
    return {
      stages: statuses
        .filter((status) => /^DEAL_STAGE(_\d+)?$/.test(status.ENTITY_ID))
        .map((status) => ({
          ENTITY_ID: status.ENTITY_ID,
          STATUS_ID: status.STATUS_ID,
          NAME: status.NAME,
          SORT: String(status.SORT),
          CATEGORY_ID: String(status.CATEGORY_ID ?? status.ENTITY_ID.split('_')[2] ?? '0'),
        })),
    };
  }),
);

app.get(
  '/api/real-expenses',
  route('expenses', async () => {
    const items = await loadExpenses();
    return { total: items.length, items };
  }),
);

app.get(
  '/api/essentials-items',
  route('Essentials only items', async () => {
    const items = await loadEssentials();
    return { total: items.length, items };
  }),
);

/**
 * Text for Bitrix24 list-field option IDs, which CRM entity types the expense
 * "Deal / Project" field can link to, the "Essentials only" Category options
 * (in Bitrix24 order) and that process's failure stages.
 */
app.get(
  '/api/field-options',
  route('field options', async () => {
    const [dealFields, expenseFields, essentialsFields, statuses] = await Promise.all([
      loadDealFields(),
      loadExpenseFields(),
      loadEssentialsFields(),
      loadStatuses(),
    ]);
    const linkSettings = expenseFields[EXPENSE_FIELDS.dealLink]?.settings ?? {};
    const essentialsStagePrefix = `DYNAMIC_${ESSENTIALS_ENTITY_TYPE_ID}_STAGE`;

    return {
      essentialsCategories: (essentialsFields[ESSENTIALS_FIELDS.category]?.items ?? []).map((item) => ({
        id: String(item.ID),
        label: item.VALUE,
      })),
      // { fieldCode: { optionId: text } } for the other "Essentials only" list fields (employee, departments).
      essentials: Object.fromEntries(
        Object.values(ESSENTIALS_FIELDS)
          .filter((code) => code !== ESSENTIALS_FIELDS.category && essentialsFields[code]?.type === 'enumeration')
          .map((code) => [code, optionsOf(essentialsFields[code])]),
      ),
      essentialsFailedStageIds: statuses
        .filter((status) => String(status.ENTITY_ID).startsWith(essentialsStagePrefix) && status.SEMANTICS === 'F')
        .map((status) => status.STATUS_ID),
      deal: Object.fromEntries(
        DEAL_CUSTOM_FIELDS.filter((code) => dealFields[code]?.type === 'enumeration').map((code) => [code, optionsOf(dealFields[code])]),
      ),
      expense: {
        [EXPENSE_FIELDS.category]: optionsOf(expenseFields[EXPENSE_FIELDS.category]),
      },
      expenseDealLinkTypes: Object.keys(linkSettings).filter((type) => linkSettings[type] === 'Y'),
    };
  }),
);

// ---------------------------------------------------------------------------
// Manual refresh: throw the cache away and load everything fresh from Bitrix24.
// ---------------------------------------------------------------------------

/** Loads (or reuses from cache) everything the dashboards need. */
function loadAll() {
  return Promise.all([
    loadDeals(),
    loadExpenses(),
    loadUsers(),
    loadDepartments(),
    loadDealCategories(),
    loadStatuses(),
    loadDealFields(),
    loadExpenseFields(),
    loadEssentials(),
    loadEssentialsFields(),
  ]);
}

let refreshInProgress = null;

/**
 * Clears the cache and fetches fresh data. Requests that arrive while a
 * refresh is running share it, so pressing "Refresh" repeatedly (or from
 * several browser tabs) only fetches from Bitrix24 once.
 * If the fetch fails, the cache stays empty and the next request tries again.
 */
function refreshAll() {
  refreshInProgress ??= (async () => {
    const started = Date.now();
    cache.clear();
    const [deals, expenses, , , , , , , essentials] = await loadAll();
    const refreshedAt = new Date().toISOString();
    console.log(
      `Cache refreshed: ${deals.length} deals, ${expenses.length} expenses, ${essentials.length} Essentials only items in ${Date.now() - started} ms`,
    );
    return { refreshedAt, deals: deals.length, expenses: expenses.length, essentials: essentials.length };
  })().finally(() => {
    refreshInProgress = null;
  });
  return refreshInProgress;
}

app.post('/api/refresh', route('fresh data', refreshAll));

// Unknown API paths get a JSON 404 (never the dashboard page).
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------------------
// The built dashboard (npm run build → dist/). Vite serves it in development.
// ---------------------------------------------------------------------------

const distDir = fileURLToPath(new URL('../dist', import.meta.url));
const indexHtml = fileURLToPath(new URL('../dist/index.html', import.meta.url));

if (existsSync(indexHtml)) {
  // File names in dist/assets contain a content hash, so browsers may keep them for a long time.
  app.use('/assets', express.static(fileURLToPath(new URL('../dist/assets', import.meta.url)), { immutable: true, maxAge: '1y' }));
  app.use(express.static(distDir));
  // Any other page address loads the dashboard (it switches pages itself via #/income etc.).
  app.get(/.*/, (req, res) => res.sendFile(indexHtml));
} else if (IS_PRODUCTION) {
  console.warn('dist/index.html not found — run "npm run build" before starting the server.');
}

app.listen(PORT, HOST, () => {
  console.log(`Bitrix API server running on http://${HOST}:${PORT}`);

  // Fill the cache right away, so the first dashboard visit does not wait for Bitrix24.
  // Same data and same 5-minute expiry as a normal request; failures are retried on the next request.
  const started = Date.now();
  loadAll().then(
    ([deals, expenses, , , , , , , essentials]) =>
      console.log(
        `Cache ready: ${deals.length} deals, ${expenses.length} expenses, ${essentials.length} Essentials only items in ${Date.now() - started} ms`,
      ),
    (error) => console.error('Cache warm-up ERROR:', error instanceof Error ? error.message : error),
  );
});
