# AVIRO Finance Dashboard: performance and searchable filters

_Date: 2026-09-25 · Branch: `step2-income` · **Not committed or pushed**. Changes are in the working tree, waiting for approval._

## Summary
| | Before | After |
|---|---|---|
| **Initial load, cold server cache** (browser, Net Revenue) | **25.0 s** | **3.5 s** (7× faster) |
| Server fetch of all Bitrix24 data (API only, cold) | 26.1 s | 2.6 s (10× faster) |
| Initial load, warm cache (browser) | 0.33 s | 0.30 s |
| First visit after the server starts | 25–26 s (cold) | Instant once the startup warm-up finishes (~2.7 s after start) |
| `/api` requests per page load | 14 (every endpoint twice) | 7 |
| Deals downloaded by the browser per page load | 2 × 2.3 MB | 1 × 2.2 MB |

**The dashboard results are unchanged.** All 6,268 deals come back with every field identical, and the total deal amount is identical (₹5,94,37,748.94 across all deals). Deal #13088 is still ₹11,48,364.

---

## 1. Before: load time and how it was measured
I didn't guess at the bottleneck; everything was measured:
- **Every Bitrix24 call** was timed by a preload script that wraps `fetch` in the API server. It logs the REST method, duration, record count and response size, and never logs the URL.
- **Every browser `/api` request** was timed in headless Chrome through the DevTools protocol.
- **The "before" numbers** come from an exact copy of the committed code (`HEAD`: old server plus old frontend), made with `git archive`.

**Frontend requests on the initial load (before):** 14 requests. `getFinanceDataset()` calls 7 endpoints, and React StrictMode's double effect in development ran it twice, so the browser downloaded the 2.3 MB deal list twice. The server's shared cache meant Bitrix24 was still only called once per endpoint.

**Backend endpoints → Bitrix24 methods (before, cold):**
| Endpoint | Bitrix24 method | Records | Time |
|---|---|---|---|
| `/api/real-deals` | `crm.deal.list`: 1 call + 3 `batch` calls (125 offset pages) | 6,268 | **26.0 s** |
| `/api/users` | `user.get` + 1 `batch` | 110 | 1.1 s |
| `/api/field-options` | `crm.deal.fields` (387 KB) + `crm.item.fields` | 910 + 21 fields | 1.2 s |
| `/api/deal-stages` | `crm.status.list` | 317 (114 deal stages) | 0.5 s |
| `/api/deal-categories` | `crm.category.list` | 11 | 1.1 s |
| `/api/departments` | `department.get` | 15 | 1.1 s |
| `/api/real-expenses` | `crm.item.list` (entity type 1048) | 0 | 1.1 s |

The endpoints are requested in parallel, so the page waits for the slowest one: `/api/real-deals`.

**Answers to the investigation questions:**
1. **Frontend requests:** 7 unique `/api` endpoints, each requested twice (14 total).
2. **Backend endpoints called:** the 7 listed above.
3. **Bitrix24 methods called:** those in the table, plus `batch`.
4. **Records per request:** 6,268 deals, 110 users, 15 departments, 11 pipelines, 114 stages (from 317 statuses), 0 expenses.
5. **Slowest request:** `crm.deal.list`, at about 97% of the cold load time. Details in section 2.
6. **Is Bitrix24 data fetched more than once?** Not from Bitrix24; the server's in-flight cache shared one fetch. The browser, however, downloaded every endpoint twice.
7. **Is metadata fetched unnecessarily?** Users, departments, pipelines and stages are small (under 1.2 s, all in parallel) and not on the critical path. Each is fetched once per 5-minute cache window.
8. **Are all 6,268 deals needed?** Yes. See "Why all deals are still loaded" below.
9. **Is the 5-minute cache reused correctly?** Yes: warm loads took 0.04 s at the API. The problem was only the cold fetch: the first visit, and the first visit after each 5-minute expiry.

## 2. Main bottleneck
**`crm.deal.list` offset paging.** Each page (`start=0, 50, 100, …`) makes Bitrix24 count all 6,268 deals again and skip past the earlier rows.
- A single page took 600–1,050 ms of Bitrix24 time.
- The same page with `start=-1` (no count) and an ID filter (`>ID`) took 170–250 ms.
- Inside a `batch` call, each ID-range command costs only about 10–40 ms.

The three sequential batches of offset pages took 8.8 s, 9.6 s and 6.6 s: about 25 of the 26 seconds.

## 3. Changes made
### Server (`server/index.js`)
1. **New `bitrixListAllById()`**, a fast full export used for deals and expenses:
   - Gets the lowest ID and total in one call and the highest ID in a parallel call.
   - Splits the ID span into ranges sized to hold about 35 records each.
   - Fetches each range with `start=-1` (no count, no offset), 50 ranges per `batch`, up to 4 batches in parallel.
   - Any range that comes back full (50 rows) is continued after its last ID until a range returns fewer than 50 rows. So every record is fetched exactly once, whatever the ID gaps. Results are de-duplicated by ID and sorted.
2. **The same 5-minute cache is kept**, with in-flight sharing.
3. **Startup warm-up:** when the server starts, it fills the same cache (same data, same 5-minute expiry). The first dashboard visit then doesn't wait for Bitrix24. If warm-up fails, the next request simply fetches again.
4. **Tidier code, same behaviour:** named cached loaders (`loadUsers`, `loadDepartments`, `loadDealCategories`, `loadStatuses`, `loadExpenses`) and a shared `bitrixBatch()` helper.
5. The existing `bitrixListAll()` is kept for the small lists. Their `batch` paging is already fast.

### Frontend
6. **`useFinanceData.ts`:** requests made while a load is already running now share it. This removes the duplicate set of 7 requests caused by StrictMode (or two components mounting at once). It shares only the load in progress and keeps no longer-lived cache, so it can't add staleness beyond the server's existing 5-minute cache.

### Why all deals are still loaded (not changed on purpose)
Loading only the selected period, or paging deals on the server, would **change how the dashboard works**:
- The year picker's options come from all deal dates.
- The Expenses "Project / Deal" list and the deal-wise P&L need every deal (an expense can link to a deal from any year).
- All filtering and report building happens in the browser, instantly, when you press Apply.

Moving that to the server would mean a new Bitrix24 round trip on every Apply, and it's a redesign of how data flows. Per your instructions I haven't done it. With the 3.5 s cold and 0.3 s warm times above, it isn't needed now.

**Not changed:** the requested fields (the deal `select` was already the 14 required fields; asking for fewer made no measurable difference), the 5-minute cache length, and every business calculation.

## 4. Searchable filters added
A new reusable component, **`src/components/SearchableSelectField.tsx`**. It takes the same props as `SelectField` (`label`, `value`, `options`, `onChange`) plus an optional `searchPlaceholder`, and uses the existing theme tokens, so light and dark mode both work.

| Dashboard | Searchable fields | Plain dropdown kept |
|---|---|---|
| Net Revenue | Responsible person, Department, Pipeline, Stage | Year (date picker unchanged) |
| Income (uses the same filter bar) | Responsible person, Department, Pipeline, Stage | Year |
| Expenses | Project / Deal (searchable by name or `#ID`), Employee name, Department, Site name | Expense category (6 fixed), Amount (6 fixed), Year |

**Behaviour:**
- **"All …" first:** it always stays first and is the default.
- **Opening:** clicking opens a search box, which gets keyboard focus.
- **Filtering:** results update as you type. Matching ignores case and works on part of a name, and every typed word must match ("minal dho" finds "Minal Dhote").
- **Selecting:** choosing an option closes the list and updates the draft filters. **Apply and Reset work exactly as before:** the "Press Apply" message still appears and Reset returns every field to "All …".
- **Keyboard:** ↓ or ↑ on the field opens the list, ↑/↓ move, Enter picks, Esc closes, Tab moves on. Clicking outside also closes the list. Screen-reader labels (ARIA combobox and listbox) are included.
- **Existing filter rules are kept:** the Stage list narrows to the chosen pipeline, and changing the department clears a responsible person who isn't in it.
- **Long lists:** the Project / Deal list has 6,269 options, so only the first 200 matches are shown, with a "N more — type to narrow the list" hint. Searching by `13088` finds "Simple Park Co-op Society (#13088)".
- **Other details:** long names show in full on hover, and "No matches" appears when nothing fits. On a phone-width screen (390 px) the dropdown fits without horizontal scrolling.

## 5. APIs and endpoints affected
| Endpoint | Change |
|---|---|
| `/api/real-deals` | Now uses fast ID-range `crm.deal.list` inside `batch`. The response shape is unchanged. |
| `/api/real-expenses` | Same fast method for `crm.item.list` (entity type 1048). The response shape is unchanged. |
| `/api/users`, `/api/departments`, `/api/deal-categories`, `/api/deal-stages`, `/api/field-options`, `/api/deal-fields` | Unchanged responses; now also pre-filled at server start. |

No new endpoints and no new Bitrix24 methods. The webhook is still only on the server.

## 6. Validation results
| Check | Result |
|---|---|
| New deal fetch vs old offset fetch | ✅ 6,268 = 6,268 deals, 0 missing, 0 extra, 0 differing fields, identical total |
| Net Revenue uses real Bitrix24 data | ✅ 2026: income ₹5,84,17,966.02, 2,598 deals, Income − Expenses = Net Revenue |
| Income uses real Bitrix24 data | ✅ Same 2,598 deals and total, 31 contributors |
| Expenses uses the real smart process | ✅ `crm.item.list` on entity type 1048 (0 records exist in Bitrix24) |
| Deal #13088 | ✅ "Simple Park Co-op Society", **₹11,48,364**, Solar sales / Site Survey & Feasibility Study, Minal Dhote, DCR, 40 kW |
| #13088 on every dashboard | ✅ Net Revenue deal table, Income deals, Expenses deal summary, including with the Responsible, Department, Pipeline and Stage filters applied |
| Existing filters (browser test) | ✅ Period/year, responsible, department, pipeline, stage, project/deal, "General (not linked)", category, amount, employee, site, Apply, Reset |
| Searchable dropdowns (browser test) | ✅ **47 of 47 automated checks passed** in headless Chrome with real clicks and typing, **0 page errors** |
| Visual check | ✅ Screenshots in light and dark mode match the existing design |
| Mock data | ✅ No dashboard imports mock data, and no mock data is in the production build |
| Webhook security | ✅ No webhook URL in `src/`, `dist/` or the changes; the server binds to `127.0.0.1` only |

## 7. `npm run lint`
✅ Passes with no errors.

## 8. `npm run build`
✅ Succeeds (`tsc -b` and `vite build`). The existing warning that the JavaScript bundle is over 500 kB (752 kB) is unchanged and is not an error.

## 9. Remaining issues
1. **Cold load after the 5-minute cache expires:** the first visit after expiry waits about 2.6 s. Warm-up only runs at server start; I didn't add a continuous background refresh, because it would call Bitrix24 every 5 minutes even when no one is using the dashboard. I can add one if you want.
2. **The browser still downloads all 6,268 deals (2.2 MB)** on each dashboard visit, served from the server cache in about 20 ms locally. If the dashboard is hosted remotely, enabling gzip on the server would shrink this about 10×. It needs a new dependency (`compression`), so I left it out.
3. **Duplicate stage names across pipelines:** with "All pipelines" selected, the Stage list has 114 stages and some names repeat in several pipelines (e.g. "Lead Qualification for Instal…"). This was already the case; choosing a pipeline first narrows the list.
4. **The Bitrix24 Expenses setup is still pending:** no records yet, no Expense Category options, and the "Deal / Project" field linked to Leads instead of Deals.
5. **Process note:** during profiling I accidentally stopped the API server you had running on port 3001. It has been restarted with the new code (`npm run server`) and is running now.
6. Cleanup (mock data) is still waiting for approval.

## Files changed (not committed)
- `server/index.js`: fast ID-range export, `bitrixBatch()`, named loaders, startup warm-up
- `src/components/SearchableSelectField.tsx`: **new** reusable searchable dropdown
- `src/components/icons.tsx`: added `ChevronDownIcon` and `SearchIcon`
- `src/features/net-revenue/NetRevenueFilterBar.tsx`: 4 searchable fields (also used by Income)
- `src/features/expenses/ExpensesFilterBar.tsx`: 4 searchable fields; Category and Amount unchanged
- `src/features/net-revenue/useFinanceData.ts`: in-flight request sharing
- `PERFORMANCE-AND-FILTERS-REPORT.md`: this report
