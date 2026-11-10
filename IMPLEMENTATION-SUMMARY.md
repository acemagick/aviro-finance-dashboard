# AVIRO Finance Dashboard: live Bitrix24 integration summary

_Date: 2026-09-25 · Branch: `step2-income` · Commit: `12a5558` "Connect dashboards to live Bitrix24 data" (not pushed)_

**Summary:** all three dashboards (Net Revenue, Income, Expenses) now load live Bitrix24 data through a local server. The Bitrix24 webhook stays on the server. Deal #13088 checks out end to end. Lint and build pass. Expenses shows ₹0 because the Bitrix24 Expenses smart process has no records yet.

## Before you run it
If an older server is still running on port 3001, stop it (Ctrl+C) and start the new one:

```
npm run server   # API server on http://127.0.0.1:3001
npm run dev      # dashboard (Vite forwards /api to the server)
```

## Bitrix24 setup needed
1. **The Expenses smart process (entity type 1048) has 0 records.** The expense field codes come from Bitrix24's own field list (`crm.item.fields`), not from a real record.
2. **The Expense Category field has no options set up.** Until AVIRO adds the six categories (e.g. "Site Expenses"), every expense will be counted as "Other Expenses".
3. **The "Deal / Project" field links to Leads, not Deals.** Until an admin changes it to link to Deals, expenses can't be matched to deals and count as general expenses. The code already handles both setups.

## a) Files changed
| File | Change |
|---|---|
| `server/index.js` | Rewritten: shared paging helper, shared 5-minute cache, stage fix, new `/api/field-options`, binds to `127.0.0.1`, generic error messages, users trimmed to 5 fields (no emails or phones) |
| `src/services/bitrixFinanceDataSource.ts` | The four empty stubs replaced with real API calls |
| `src/services/bitrixMappers.ts` | Null-safe mappers, list-option ID → text, new expense mapper |
| `src/services/financeDataService.ts` | Maps expenses; orders stages pipeline by pipeline |
| `src/services/financeDataSource.ts` | Expenses now come in raw form; new `getFieldOptions()` |
| `src/types/bitrix.ts` | Added expense and field-option types; optional fields made safe |
| `src/config/finance.ts` | Checked field codes, fixed the placeholder `projectType`, added the expense field codes |
| `src/services/mockFinanceDataSource.ts`, `src/data/mock/expenses.ts` | Type fixes only, so the build still compiles; not deleted |
| `vite.config.ts` | Proxy now points to `127.0.0.1:3001` |
| `package.json` | Added the `server` script |
| `AUDIT-REPORT.md` | Audit plus an implementation update |

The commit also includes the earlier uncommitted UI edits, including the removed demo-data notice. The old `/api/deals` endpoint (first page only, unused) was removed.

## b) Bitrix24 APIs used
- **Deals:** `crm.deal.list`, `crm.deal.fields`, `crm.deal.get`
- **Expenses:** `crm.item.list`, `crm.item.fields` (entity type 1048)
- **Pipelines and stages:** `crm.category.list`, `crm.status.list`
- **People:** `user.get`, `department.get`
- **Paging:** `batch`
- **Discovery only:** `crm.type.list`, `userfieldconfig.list`

## c) Real field mappings
**Deals:**
| Dashboard field | Bitrix24 field |
|---|---|
| Income | `OPPORTUNITY` |
| Site Name | `UF_CRM_6911972A7FFDB` (text, can hold several values) |
| Project Type | `UF_CRM_68B1565B081A1` "Type of Project" (192=DCR, 194=NON DCR) |
| Plant capacity (kW) | `UF_CRM_69141F2229AB2` "Required Plant Capacity (Kwp)" (free text such as "40 kwp", read as 40) |
| Lead Category | `UF_CRM_68B92E527B456` (list, can hold several values) |

**Expenses smart process:**
| Dashboard field | Bitrix24 field |
|---|---|
| Name | `title` |
| Amount | `ufCrm12_1790320689`, sent as "1500\|INR" |
| Category | `ufCrm12_1790320851` |
| Linked deal | `ufCrm12_1790320964` |
| Employee | `assignedById` |
| Date | `createdTime` |

The smart process has **no Department, Site Name or Expense Date field**. So department comes from the responsible person, site name from the linked deal, and the date is the record's created date.

## d) Pagination
One helper, `bitrixListAll`, is used for every list endpoint. It reads the first page to get the total, then requests the remaining pages in groups of up to 50 per `batch` call and retries when Bitrix24 rate-limits. All 6,268 deals load in about 26 s with no duplicates, cached for 5 minutes.

## e) How each dashboard gets live data
All three follow the same path: `useFinanceData` → `getFinanceDataset` → the `/api/*` endpoints on the server → Bitrix24.
- **Net Revenue** combines real deals with expenses. I checked that Income − Expenses = Net Revenue holds.
- **Income** uses real deal amounts, with real people, departments, pipelines and stages.
- **Expenses** uses the real smart process.

No dashboard imports mock data, and none of it is in the production build.

## f) Deal #13088
✅ **Passed.** It comes through as "Simple Park Co-op Society", **₹11,48,364** INR, pipeline "Solar sales", stage "Site Survey & Feasibility Study", responsible Minal Dhote, site "Simple Park Co-op Society", DCR, 40 kW, lead category "Solar Sales".
- It appears in the Net Revenue deal table (net ₹11,48,364, since it has no expenses), in the Income deals table, and in the Expenses deal summary.
- With the pipeline, stage, department and person filters set to match it, it is still returned.
- A made-up ₹10,000 expense linked to it (in memory only, nothing written to Bitrix24) gave a net of ₹11,38,364, and general expenses were counted separately.

## g) Lint
✅ `npm run lint` passes with no errors. ESLint only checks `.ts`/`.tsx` files, so the server file was checked with `node --check` instead.

## h) Build
✅ `npm run build` succeeds. It shows a warning (not an error) that the JavaScript bundle is larger than 500 kB. The built files contain no webhook.

## Security of BITRIX_WEBHOOK_URL
- Only the server reads it, from `.env`, which is git-ignored and has never been committed.
- It is not in `src/`, `dist/` or the commit.
- The server binds to `127.0.0.1` only.
- The browser gets generic error messages; full details are logged on the server only.

## i) Remaining issues
1. The three Bitrix24 setup problems above.
2. Please confirm with AVIRO:
   - Project Type is my reading of the "Type of Project" field.
   - Capacity uses "Required" rather than "Final Plant Capacity" (`UF_CRM_69141F5904B3C`).
3. The first load after the server starts, and after each 5-minute cache expiry, takes about 26 s. The existing loading state covers it.
4. With "All pipelines" selected, the stage dropdown lists all 114 stages, grouped pipeline by pipeline.
5. Deal amounts are added up as INR with no currency conversion (unchanged from before).
6. Cleanup (mock data) and a `.env.example` are waiting for approval.
