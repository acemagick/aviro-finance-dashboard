# AVIRO Finance Dashboard: data refresh and cache report

_Last updated: 2026-09-28 (final completion pass) · Branch: `step2-income` · Refresh code: commit `b57a047` · This report update is **not committed or pushed**; no PR._

**Status: COMPLETE.** "Refresh data" works on all three dashboards against live Bitrix24 data, without restarting the backend.

---

## 1. Previous cache behaviour
`server/index.js` kept every Bitrix24 dataset in memory for **5 minutes** (`CACHE_TTL`). This covers deals, expenses, users, departments, pipelines, stages and field definitions.
- **At startup:** the server fills the cache right away.
- **Within 5 minutes:** every request is answered from the cache. Requests arriving while a fetch is running share that fetch.
- **The problem:** there was no way to bypass or clear the cache. Reloading the browser just got the same cached copy, so a new or edited deal or expense only appeared after the cache expired or **Node was restarted**.
- **A hidden bug:** in `cached()`, a slow fetch that started *before* a cache clear could finish *after* it and overwrite fresher data.

## 2. Root cause
**a) Data not updating (original problem):** there was no cache-invalidation mechanism (section 1).

**b) "Refresh data" always showing "Refresh failed":** the API server on port 3001 was an **old process** that predated the refresh feature.

| Evidence | Value |
|---|---|
| Process on port 3001 at the time | PID 98399 `node server/index.js`, started **25 Sep 18:44** |
| `server/index.js` last changed (added `/api/refresh`) | **28 Sep 12:03** |
| `POST /api/refresh` response | **HTTP 404**, `Content-Type: text/html`, body `Cannot POST /api/refresh` |
| Same request to a made-up route | 404 (identical), so the route didn't exist in that process |
| `GET /api/users`, `/api/real-deals` | 200, which is why normal dashboard data still loaded |
| Browser | `refreshServerData()` got 404 → `Error("Refresh failed: 404")` → the button showed "Refresh failed" |
| Server log | nothing logged (Express doesn't log 404s); no Bitrix24 call was ever made |

Node doesn't reload changed files, so the old process kept serving the old code. A copy of the server started from a terminal would also have failed to start while the old process held port 3001 ("address already in use").

**Diagnosis in the final pass (28 Sep):** I checked all 7 points requested:
1. **Browser request:** `POST /api/refresh` → **HTTP 200** in 1.9–2.4 s (captured with the DevTools protocol in the browser).
2. **Endpoint:** `app.post('/api/refresh', …)` is present at `server/index.js:433`.
3. **Status and response:** HTTP **200**, JSON `{"refreshedAt":"…","deals":6281,"expenses":2}`, both directly and through the dashboard's Vite proxy on port 5173.
4. **Browser console:** **no errors**. The only message is the expected `[AVIRO]` warning that expense #2 is linked to a lead (`L_33482`) and counts as general.
5. **Port 3001:** PID **99062** `node server/index.js`, started **28 Sep 12:20**, after the last change to `server/index.js`. So it runs the current code.
6. **Bitrix24 calls during a refresh:** the server log shows one `Cache refreshed: 6281 deals, 2 expenses in ~2–3 s` per refresh. It uses the fast loaders (`crm.deal.list` and `crm.item.list` by ID range in `batch`, plus users, departments, pipelines, stages and field definitions).
7. **Cache:** 5-minute TTL, race-safe `cached()`, and `refreshAll()` clears it and shares a running refresh (section 3).

Server log since the restart: **13 successful refreshes, 0 errors.**

## 3. Fix implemented
**Code** (commit `b57a047`, already on `step2-income`). **No further code changes were needed in this final pass**, because nothing was wrong with the code.
- **Server `POST /api/refresh` (`refreshAll()`):** clears the whole cache, reloads everything from Bitrix24 with the existing fast loaders, and returns `{ refreshedAt, deals, expenses }`. A refresh that's already running is shared, so there's never more than one Bitrix24 fetch.
- **Race fix in `cached()`:** a finished fetch is stored only if its cache entry wasn't replaced in the meantime.
- **Shared loader list:** `loadAll()` is used by both the startup warm-up and the refresh.
- **Errors:** they go through the existing `route()` wrapper. The server log gets the details; the browser only gets a generic message.
- **Frontend:**
  - `FinanceRefreshProvider` and `refreshContext` hold the shared refresh state; a ref-based guard blocks double clicks.
  - `RefreshDataButton` is the header button.
  - `useFinanceData` reloads when the refresh `version` changes.
  - `financeDataService` provides `refreshServerData()` and a shared `loadFinanceDataset({ startNew })`.

**Operational fix:** I stopped the outdated server (PID 98399) and started the current code (`npm run server`, PID 99062). It has not been restarted since, and the live test below ran against it.

No new packages. The webhook, business calculations, mappings, filters and layout are unchanged.

## 4. Refresh behaviour
- **Click "Refresh data":**
  - The icon spins, the label says "Refreshing…" and the button is disabled; the status text reads "Fetching latest Bitrix24 data…".
  - The server clears its cache and fetches fresh Bitrix24 data (about 2–3 s).
  - The open dashboard reloads **in place**: the figures stay visible until the new ones arrive, and filters are kept.
  - The header then shows "Updated hh:mm".
  - Net Revenue, Income and Expenses all use the refreshed data.
- **No click:** the normal 5-minute cache applies, with loads of about 0.3 s. It refreshes automatically after 5 minutes, or at server start.
- **Duplicates:** double or triple clicks, several tabs, or simultaneous API calls produce **one** Bitrix24 refresh.
- **Errors:**
  - The last good figures stay on screen.
  - The header shows "Refresh failed" in red, with the reason in the button's tooltip.
  - The button can be clicked again.
  - If the fresh data itself can't load, the dashboard's existing "Try again" panel appears.

## 5. Live before/after test (final pass, backend NOT restarted)
Tested in headless Chrome with real clicks on **your dev server (`localhost:5173`)** and **your running backend (`127.0.0.1:3001`, PID 99062)**.
- **Test deal:** #13358 "Dashboard Test Deal - Anuj" (₹1,00,000, Anuj Suryawanshi).
- **Test expense:** item #4 "Test Expense - Dashboard Test Deal", linked `D_13358`.
- **Changes made to Bitrix24:** only item #4's amount (`crm.item.update`), and it was restored at the end.

| # | Step | Result |
|---|---|---|
| 1 | Expense #4 is ₹10,000 | Expenses: income ₹1,00,000 · expenses ₹10,000 · net **+₹90,000** · 90.0% ✅ |
| 2 | Bitrix24: expense → **₹11,000**; switch dashboards, re-apply (no refresh) | Still ₹10,000 (cache), confirming the original problem ✅ |
| 3 | Click **Refresh data** | "Refreshing…" with button disabled → `POST /api/refresh` **200** in 2.4 s → one server refresh ✅ |
| 4 | Expenses dashboard | Expenses **₹11,000** · net **+₹89,000** · 89.0%; deal filter kept; "Updated hh:mm" ✅ |
| 5 | Net Revenue (Responsible = Anuj Suryawanshi) | #13358: ₹1,00,000 · ₹11,000 · **+₹89,000** · 89.0% ✅ |
| – | Income | #13358 at ₹1,00,000 ✅ |
| – | Triple click / 3 simultaneous `POST /api/refresh` | One refresh each; all 3 calls got the same `refreshedAt` ✅ |
| 6 | Bitrix24: expense → **₹10,000** | Bitrix24 confirmed `10000\|INR` ✅ |
| 7 | Click **Refresh data** on the open Net Revenue page | `POST /api/refresh` **200** in 1.9 s ✅ |
| 8 | Net Revenue | #13358: ₹10,000 · **+₹90,000** · 90.0% ✅ |
| 9 | Expenses / Income / Net Revenue | Expenses ₹10,000, net ₹90,000; summary, category chart and items table render; Income and Net Revenue work ✅ |

**Result: 15 of 15 checks passed.** All 3 browser refresh requests returned HTTP 200, with no console errors.
**Bitrix24 afterwards:** expense #4 = `10000|INR` → `D_13358`, unchanged from before the test.

**Earlier test of the error path** (isolated copy, before the final pass): with the server stopped, clicking Refresh showed "Refresh failed", the KPIs stayed on screen and the button could be clicked again. With the server back, the refresh succeeded ✅.

## 6. Validation results
| Check | Result |
|---|---|
| Manual refresh invalidates the server cache and fetches fresh Bitrix24 data | ✅ |
| Works without restarting the backend | ✅ Same process (PID 99062) throughout |
| Normal 5-minute cache kept | ✅ No click → cached data (step 2) |
| Duplicate simultaneous refreshes prevented | ✅ Browser guard plus shared server refresh |
| Loading state | ✅ |
| Errors handled gracefully | ✅ |
| Net Revenue, Income, Expenses | ✅ All show refreshed figures and still work |
| Business calculations | ✅ Unchanged (₹1,00,000 − ₹11,000 = ₹89,000; − ₹10,000 = ₹90,000) |
| Mock data | ✅ Not used by any dashboard; 0 mock markers in the production bundle |
| Webhook / credentials | ✅ `BITRIX_WEBHOOK_URL` is read only in `server/index.js` (from `.env`); no webhook URL or credentials in `src/`, `server/index.js`, `dist/` or the reports |

## 7. Lint result
✅ `npm run lint` passes with no errors.

## 8. Build result
✅ `npm run build` succeeds (`tsc -b` and `vite build`, 963 modules). The existing warning that the JavaScript bundle is over 500 kB (755 kB) is unchanged and is not an error.

## 9. Remaining limitations
1. **Keep the backend current.** After any future change to `server/index.js`, restart the server (`npm run server`); Node doesn't reload code by itself. Only one server can use port 3001, so stop the old one first. That's exactly what caused "Refresh failed".
2. **The current backend (PID 99062) runs as a background process of the Claude session,** so it may stop when that session ends. You can run `npm run server` in your own terminal instead to see its logs.
3. **A refresh reloads all data** (6,281 deals plus metadata, about 2–3 s), not just the changed record. That keeps all figures consistent.
4. **The cache is shared,** so one user's refresh updates the data for everyone on the same server.
5. **Other open browser tabs** keep their figures until they're reloaded or refreshed themselves.
6. **Automatic updates** without clicking would need Bitrix24 outbound webhooks (events); that's out of scope.
7. **`/api/refresh` has no login,** like the other `/api` endpoints. It's safe only while the server listens on `127.0.0.1`; add authentication before hosting it for others.
8. **Expense #2** (₹4,999) is linked to a lead (`L_33482`), so it counts as a general expense.
9. **Getting this into `main`:** `step2-income` is already merged into `main` (PR #1), so the refresh commit `b57a047` needs a new PR.
