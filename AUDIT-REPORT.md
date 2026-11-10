# AVIRO Finance Dashboard: read-only audit

_Audit date: 2026-09-25. No project files were modified during the audit._

**Summary:** the dashboards already call Bitrix24 through a local server, but only half-way. Deals and expenses come in from Bitrix24. Users, departments, pipelines and stages come back empty, and several deal and expense fields are never fetched or mapped.

## 1. Structure and important files
- **Frontend:** React 19, Vite 8, Tailwind 4, Recharts. Each dashboard lives in `src/features/{net-revenue,income,expenses}/`.
- **Data layer:** `src/services/` contains:
  - `financeDataService.ts`: the entry point the UI calls.
  - `financeDataSource.ts`: the interface every data source implements.
  - `bitrixFinanceDataSource.ts`: the real source (not yet tracked by git).
  - `mockFinanceDataSource.ts`: the fake source.
  - `bitrixMappers.ts`: converts raw Bitrix24 records into the app's shapes.
- **Types and config:** `src/types/bitrix.ts` holds the raw Bitrix24 shapes. `src/config/finance.ts` holds business rules and custom field codes.
- **Backend:** `server/index.js`, an Express server on port 3001 (not yet tracked by git).

## 2–4. Where each dashboard gets its data
All three use the same path: `useFinanceData()` (`src/features/net-revenue/useFinanceData.ts`) → `getFinanceDataset()` → `bitrixFinanceDataSource` by default (`financeDataService.ts:19`). The browser calls `/api/*`, Vite forwards that to `localhost:3001`, and the Express server calls Bitrix24.

| Data | Endpoint | Status |
|---|---|---|
| Deals (Net Revenue, Income) | `/api/real-deals` → `crm.deal.list`, all pages, 5-minute cache | Real, but the request doesn't ask for the custom `UF_CRM_*` fields, so Site Name, Project Type, Capacity and Lead Category are always empty |
| Expenses (Expenses, Net Revenue) | `/api/real-expenses` → `crm.item.list` on smart process 1048 | Real, but only the first 50 records (no paging); `employeeId`, `departmentId` and `siteName` are hard-coded blank; the title is a made-up "Expense #id" |
| Users | — | The frontend returns `[]`, although the server endpoint `/api/users` exists |
| Departments | — | Returns `[]`; the server endpoint `/api/departments` exists |
| Pipelines (deal categories) | — | Returns `[]`; the server endpoint `/api/deal-categories` exists |
| Stages | — | Returns `[]`; the server endpoint `/api/deal-stages` exists |

Because those four lists are empty, names for responsible people, departments, pipelines and stages, and the filters that use them, won't work with live data.

## 5. Mock, demo and placeholder sources
- `src/data/mock/*`: fake deals, users, departments and expenses, plus a fake clock (`mockClock.ts`). Only `mockFinanceDataSource.ts` uses these, and nothing in the UI uses that source any more, so they're dead code.
- The four `return []` stubs in `bitrixFinanceDataSource.ts`.
- `src/config/finance.ts:34`: `projectType: 'UF_CRM_PROJECT_TYPE'` is a placeholder, not a real field code. The other three codes look real but haven't been verified.
- The expense category mapping falls back to "Other" for any value it doesn't recognise. If Bitrix24 sends category IDs rather than text, every expense will land in "Other".
- A few comments are out of date ("Today: mockFinanceDataSource", "Step 5"), and the `KpiCard` comment mentions a "Demo" tag.

## 6. Existing Bitrix24 integration code
- `server/index.js` has these endpoints: `deal/:id`, `deals`, `deal-fields`, `users`, `departments`, `deal-categories`, `deal-stages`, `real-expenses` and `real-deals`.
- `bitrixFinanceDataSource.ts` and `bitrixMappers.ts` on the frontend side.
- Problems in the server code:
  - Only `real-deals` fetches more than one page. `users`, `departments`, `real-expenses` and `deal-stages` stop at the first 50 records.
  - `/api/deal-stages` builds its filter as `filter[]=ENTITY_ID&filter[]=DEAL_STAGE`, which is malformed. It should be `filter[ENTITY_ID]=…`. It also only asks for the default pipeline's stages; other pipelines use `DEAL_STAGE_<id>`.

## 7. Backend layer
There is one, `server/index.js`, but:
- No npm script starts it. You have to run `node server/index.js` by hand next to `npm run dev`.
- It listens on all network interfaces and has no authentication, so anyone on the same network can read CRM data through it.
- It sends `String(error)` back to the browser. Low risk, but it can leak internal details.

## 8. Environment variables
- `.env` holds one key, `BITRIX_WEBHOOK_URL` (value not reproduced here). The server loads it with `dotenv/config`.
- `.env` is in `.gitignore` (added in the uncommitted `.gitignore` change) and has never been committed; git history has no matches.
- There's no `.env.example`.

## 9. Is the webhook exposed to the browser?
**No.** Nothing in `src/` reads `import.meta.env` except `BASE_URL`, there are no `VITE_` variables, and the webhook appears nowhere in `src/` or `dist/`. The browser only ever sees `/api/*`. The one caveat is the open, unauthenticated server from section 7.

## 10. What must change for fully live data
1. **Server:**
   - Add one shared paging helper and use it for every list endpoint.
   - Fix the stage query and fetch stages for every pipeline.
   - Add `UF_CRM_*` to the deal `select`.
   - Fetch all expense records, including the fields for responsible person, date and linked deal.
   - Tighten error responses and bind to `127.0.0.1`.
2. **`bitrixFinanceDataSource.ts`:** replace the four `[]` stubs with calls to the existing endpoints, and map expense employee, department, site and title from real fields.
3. **`config/finance.ts`:**
   - Confirm the real `UF_CRM_*` codes using `/api/deal-fields`.
   - Confirm the expense smart process field codes (`ufCrm12_*`).
   - Check whether list-type fields return option IDs; those need translating to text.
4. **Mappers:** make `mapBitrixUser` and `mapBitrixDeal` safe against missing values (`UF_DEPARTMENT` can be absent; `BEGINDATE` can be empty).
5. **Cleanup:** remove `server/index.jsy`, the mock data, the unused mock source and the `fix-*.mjs` scripts, and add a `.env.example`.
6. **Scripts:** add `"server": "node server/index.js"`, and optionally a way to run both with one command.

No UI components need to change for any of this.

## 11. `package.json` scripts
`dev` (vite), `build` (`tsc -b && vite build`), `lint`, `preview`. There's no server script. `express` and `dotenv` are in `dependencies`.

## 12. Git
- Branch: `step2-income`, although the latest commit is "Build Step 3 expenses dashboard".
- Uncommitted: 16 modified files (one of them, `DemoDataNotice.tsx`, deleted).
- Untracked: `server/`, `bitrixFinanceDataSource.ts` and the two `fix-*.mjs` scripts.
- All of the Bitrix24 work is uncommitted. I'd suggest committing it (or moving it to a new branch) before the next step.

## Open questions before making changes
- Output from `/api/deal-fields` and one sample expense item, so the real field codes can be confirmed.
- Whether the cleanup in section 10, item 5 should be included.

---

## Implementation Update — 2026-09-25

_Nothing was committed or pushed. No mock or old files were deleted. No data was written to Bitrix24._

### Bitrix24 setup needed
1. **The Expenses smart process (entity type 1048) has 0 records.** The expense field codes below come from Bitrix24's own field list (`crm.item.fields`), not from a real record.
2. **The Expense Category field has no options set up** (its option list is empty). Until AVIRO adds the six categories, every expense will be counted as "Other Expenses".
3. **The "Deal / Project" field links to Leads only, not Deals.** Until an admin changes it to link to Deals, expenses can't be matched to deals and count as general expenses. The code already handles both setups.

### 1. Files changed
| File | Change |
|---|---|
| `server/index.js` | Rewritten: shared paging helper, shared 5-minute cache, stage fix, new `/api/field-options`, binds to `127.0.0.1`, generic error messages to the browser, users trimmed to ID, name, department and active flag |
| `src/services/bitrixFinanceDataSource.ts` | The four empty `[]` stubs replaced with real API calls |
| `src/services/bitrixMappers.ts` | Null-safe mappers, list-option ID → text, new `mapBitrixExpense`, `toLinkedDealId` and `parseMoney` |
| `src/services/financeDataService.ts` | Maps raw expenses; orders stages by pipeline, then stage |
| `src/services/financeDataSource.ts` | `getExpenses()` returns raw smart process items; new `getFieldOptions()` |
| `src/types/bitrix.ts` | Added `BitrixExpenseItem`, `BitrixFieldOptions` and `BitrixFieldValue`; optional user fields |
| `src/config/finance.ts` | Checked deal field codes, replaced the placeholder `projectType`, added `EXPENSE_FIELDS` |
| `src/services/mockFinanceDataSource.ts`, `src/data/mock/expenses.ts` | Type fixes only, so the build still compiles; not deleted |
| `vite.config.ts` | Proxy now points to `http://127.0.0.1:3001` |
| `package.json` | Added the `"server": "node server/index.js"` script |

The old `/api/deals` endpoint (first page only, unused) was removed.

### 2. Bitrix24 APIs now used
- **Deals:** `crm.deal.list`, `crm.deal.fields`, `crm.deal.get` (single-deal endpoint)
- **Expenses:** `crm.item.list` and `crm.item.fields` (entity type 1048)
- **Pipelines and stages:** `crm.category.list` (entity type 2), `crm.status.list` (filtered on the server to `DEAL_STAGE` and `DEAL_STAGE_<id>`)
- **People:** `user.get`, `department.get`
- **Paging:** `batch`
- **Discovery only:** `crm.type.list`, `userfieldconfig.list`

### 3. Field mappings discovered
**Deals** (checked with `crm.deal.fields`):
| Dashboard field | Bitrix24 field | Type |
|---|---|---|
| Income | `OPPORTUNITY` | number sent as text |
| Site Name | `UF_CRM_6911972A7FFDB` | text, can hold several values (joined with ", ") |
| Project Type | `UF_CRM_68B1565B081A1` "Type of Project" | list: 192=DCR, 194=NON DCR |
| Plant capacity (kW) | `UF_CRM_69141F2229AB2` "Required Plant Capacity (Kwp)" | free text, e.g. "40 kwp", read as 40 |
| Lead Category | `UF_CRM_68B92E527B456` | list, several values (e.g. 4300=Solar Sales) |

**Expenses smart process** (checked with `crm.item.fields`):
| Dashboard field | Bitrix24 field | Notes |
|---|---|---|
| Name | `title` | Falls back to "Expense #id" |
| Amount | `ufCrm12_1790320689` | Money, sent as "1500\|INR" |
| Category | `ufCrm12_1790320851` | List; the option ID is turned into text, then into one of AVIRO's six categories |
| Linked deal | `ufCrm12_1790320964` | CRM link; currently set up for Leads only |
| Employee | `assignedById` | Standard field |
| Date | `createdTime` | The smart process has no separate expense date |
| Department | — | No such field; taken from the responsible person |
| Site name | — | No such field; taken from the linked deal |

### 4. Pagination changes
- `bitrixListAll()` reads the first page to get the total, then requests the remaining pages in groups of up to 50 per `batch` call. It retries when Bitrix24 rate-limits (`QUERY_LIMIT_EXCEEDED` or HTTP 503).
- It is used for deals, expenses, users, departments, pipelines and statuses.
- Result: all 6,268 deals load (no duplicates) in about 26 s. Results are cached for 5 minutes, and parallel requests share one fetch.

### 5. Net Revenue: live data
✅ Live. It uses real deals and real expenses. I checked that Income − Expenses = Net Revenue holds. Pipeline, stage, department and responsible-person filters use real data (11 pipelines, 114 stages, 15 departments, 110 users). Expenses are currently ₹0 because the smart process is empty.

### 6. Income: live data
✅ Live. It uses the real deal amount (`OPPORTUNITY`). With the current year selected: 2,598 deals, 31 contributors, all real pipeline, stage, department and person names.

### 7. Expenses: live data
⚠️ Connected, but there's no data yet. It reads the real smart process (0 records today) and never falls back to mock data. Category, deal and "General" linking, employee, department, site, amount and date filters all work on the mapped fields. Expenses only link to deals once the "Deal / Project" field links to Deals (see the setup list above).

### 8. Deal #13088
✅ **Passed.** It comes through from Bitrix24 as:
- "Simple Park Co-op Society", **₹11,48,364** (`1148364.00` INR)
- Pipeline "Solar sales", stage "Site Survey & Feasibility Study", in progress
- Responsible Minal Dhote, department "AVIRO ENERGY INDIA PVT LTD"
- Site "Simple Park Co-op Society", DCR, 40 kW, lead category "Solar Sales"

Where it appears:
- The Net Revenue deal table (net ₹11,48,364, with no expenses).
- The Income deals table.
- The Expenses deal summary.
- It is still returned with its pipeline, stage, department and person filters applied.

As an in-memory test, a made-up ₹10,000 expense linked to this deal gave a net of ₹11,38,364, and general expenses were counted separately.

### 9. Mock data
- Nothing in any dashboard imports mock data. `getFinanceDataset()` uses `bitrixFinanceDataSource` by default.
- Mock data is not in the production build (checked by searching the bundle).
- `src/data/mock/*` and `mockFinanceDataSource.ts` are still there, labelled "offline testing only", waiting for approval to delete.

### 10. Security of BITRIX_WEBHOOK_URL
✅ It stays on the server only.
- Only `server/index.js` reads it, from `.env`. `.env` is git-ignored and has never been committed.
- It is not in `src/` or `dist/`, and there are no `VITE_` variables.
- The server now binds to `127.0.0.1` only.
- The browser gets generic error messages; full details are logged on the server only, and they don't include the webhook.
- User records sent to the browser contain only ID, name, department and active flag.

### 11. `npm run lint`
✅ Passes with no errors. ESLint only checks `.ts`/`.tsx` files; `server/index.js` was checked with `node --check`.

### 12. `npm run build`
✅ Succeeds (`tsc -b` and `vite build`). There's one warning, not an error, that the JavaScript bundle is larger than 500 kB (748 kB).

### 13. Remaining issues
1. The three Bitrix24 setup problems above: no expense records, no category options, and the deal link set to Leads.
2. Please confirm with AVIRO:
   - Project Type is my reading of the "Type of Project" field.
   - Capacity uses "Required Plant Capacity" rather than "Final Plant Capacity (Kwp)" (`UF_CRM_69141F5904B3C`).
3. The first load after the server starts, and after each 5-minute cache expiry, takes about 26 s. The existing loading state covers it.
4. With "All pipelines" selected, the stage dropdown lists all 114 stages, grouped pipeline by pipeline.
5. Deal amounts are added up as INR with no currency conversion (unchanged).
6. A server still running the old code on port 3001 must be restarted with `npm run server` for the dashboard to use the new endpoints.
7. Cleanup (mock data) and a `.env.example` are waiting for approval.
