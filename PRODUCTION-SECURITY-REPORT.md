# AVIRO Finance Dashboard: production security and branding report

_Date: 2026-09-28 · Branch: `step2-income` (working tree) · **Not committed, not pushed, not deployed, no PR.**_

**Final status: SAFE TO DEPLOY** (with the Render settings in section 12).

---

## 1. Security issue identified
Running the app as a public web service would have exposed AVIRO's finance data to anyone with the URL:
- **No login:** all financials, deal titles (customer names) and employee names were readable.
- **Debug endpoints** returned raw Bitrix24 data the dashboard doesn't use:
  - `GET /api/deal/:id` returned a **complete raw Bitrix24 deal record**.
  - `GET /api/deal-fields` returned the full CRM field definitions.
  - `GET /api/deals` (from an earlier version) had already been removed.
- **`POST /api/refresh` could be called by anyone,** and each call re-downloads all 6,281 deals, which risks Bitrix24 rate limits.

## 2. HTTP Basic Auth
In `server/index.js`, using only built-in Node modules (no new packages):
- **Scope:** in production (`NODE_ENV=production`), one Express middleware runs **before every route and every static file**. It covers the dashboard page, JavaScript/CSS, the logo and favicon, and every `/api` endpoint including `/api/refresh`.
- **Without valid credentials:** **HTTP 401** with `WWW-Authenticate: Basic realm="AVIRO Finance Dashboard", charset="UTF-8"` and the body `Authentication required.` Browsers then show their normal login prompt.
- **Where the credentials come from:** only `process.env.DASHBOARD_USERNAME` and `process.env.DASHBOARD_PASSWORD`. They're never hard-coded, never sent to the browser and never logged.
- **Comparison:** both values are hashed (SHA-256) and compared with `crypto.timingSafeEqual`, both always, so response timing doesn't reveal which one was wrong. Scheme names are case-insensitive; other schemes (such as `Bearer`) and malformed headers are rejected.
- **Fail-safe:** if either variable is missing in production, the server **refuses to start** ("DASHBOARD_USERNAME and DASHBOARD_PASSWORD must be set in production"), so it can never run unprotected by mistake.
- **Local development is unchanged:** `npm run server` + `npm run dev` need no login.

## 3. Debug endpoints disabled in production
| Endpoint | Production | Development |
|---|---|---|
| `GET /api/deal/:id` | **Not registered** → JSON 404 `{"error":"Not found"}`, even when logged in | Available |
| `GET /api/deal-fields` | **Not registered** → JSON 404, even when logged in | Available |
| `GET /api/deals` | Doesn't exist (removed earlier) → JSON 404 | → 404 |

The dashboard doesn't use any of them. Field definitions are still loaded on the server for `/api/field-options`, which the dashboard does use.

**Dashboard APIs that stay enabled (behind the login):** `/api/real-deals`, `/api/users`, `/api/departments`, `/api/deal-categories`, `/api/deal-stages`, `/api/real-expenses`, `/api/field-options`, `POST /api/refresh`.

## 4. Environment variables
| Variable | Required | Purpose |
|---|---|---|
| `BITRIX_WEBHOOK_URL` | **Yes** (always) | Bitrix24 inbound webhook; server-side only |
| `DASHBOARD_USERNAME` | **Yes in production** | Login username |
| `DASHBOARD_PASSWORD` | **Yes in production** | Login password; use a long random value |
| `NODE_ENV` | Optional | `npm start` already sets `production`. Setting it on Render too is harmless. |
| `PORT` | No | Set automatically by Render; defaults to 3001 locally |
| `HOST` | No | Leave unset; production defaults to `0.0.0.0` |

No other environment variables are used by the project. `.env.example` lists all of them with **placeholder values only**.

## 5. Bitrix webhook security (verified)
| Check | Result |
|---|---|
| Read only by server-side code | ✅ Only `server/index.js` (`process.env.BITRIX_WEBHOOK_URL`, line 23) |
| Not in `src/` | ✅ Neither the variable name nor the actual webhook host or code |
| Not in `dist/` | ✅ Same check on the production build |
| Not returned by any API response | ✅ Every response body and header in the security test was scanned for the full URL, the portal host and the secret code: none found |
| Not logged to the browser | ✅ Browsers get generic errors only; the server never prints `webhookUrl` |
| Not hard-coded | ✅ Only `process.env`; `.env.example` holds a placeholder |
| `.env` git-ignored | ✅ `.gitignore:25` |

The same scans found **no dashboard credentials** in `src/`, `dist/`, `server/index.js`, the reports, `.env.example`, the server logs or the exported CSVs.

## 6. Favicon
- `index.html` now uses the **existing** `public/aviro-logo.png`, which is also the header logo:
  ```html
  <link rel="icon" type="image/png" href="/aviro-logo.png" />
  <link rel="apple-touch-icon" href="/aviro-logo.png" />
  ```
  This replaces the default Vite `favicon.svg` link; that file was left in place, unused.
- **No new logo was created or downloaded,** and `public/aviro-logo.png` is unchanged.
- **Development:** the Vite dev server serves the new link, and `/aviro-logo.png` returns 200 `image/png` (110,027 bytes).
- **Production:** `dist/index.html` has the same link. `dist/aviro-logo.png` is **byte-identical** to `public/aviro-logo.png`. Once logged in, the favicon loads 200 `image/png`, 110,027 bytes.

## 7. Production behaviour
- **`npm start`** runs `NODE_ENV=production node server/index.js`:
  - Listens on `0.0.0.0:$PORT`.
  - Requires the login for everything.
  - Debug endpoints are off.
  - Serves the built dashboard from `dist/`: hashed `/assets` are cached for 1 year, and any other page address loads `index.html`.
  - Unknown `/api` paths return a JSON 404.
- **Unchanged:**
  - Real Bitrix24 data and mappings.
  - Business calculations.
  - The 5-minute cache, cache warm-up at startup, and `POST /api/refresh` with shared in-flight refreshes.
  - All three dashboards, filters, search, charts, tables, CSV export and theme.
- **Development (`npm run server` + `npm run dev`):** unchanged, bound to `127.0.0.1`, no login.

## 8. Test procedure
All tests ran against the **real production start command** (`npm start`) on a local test port, with **throwaway random test credentials**. These were kept in a private file outside the project (mode 600), never printed, and **deleted after testing**. For the tests only, the server was bound to `127.0.0.1` so live data wasn't reachable from the network. Your development servers (3001, 5173) weren't touched.
1. **Start without credentials:** `npm start` must refuse to start.
2. **HTTP tests** (Node script): unauthenticated requests, wrong credentials, authenticated requests, debug endpoints, and an exposure scan of every response.
3. **Browser tests** (headless Chrome, DevTools protocol, real clicks and typing):
   - Chrome's real Basic Auth challenge was answered like a user typing into the login prompt.
   - Then all three dashboards, filters, search, Refresh, CSV export, theme and the favicon.
4. **Development workflow:** `npm run server` without `NODE_ENV` or the dashboard credentials; favicon through the Vite dev server.
5. **Scans** of the source, the build, the reports, the logs and the exported CSVs.

## 9. Test results
**Startup safety:** `npm start` without the credentials → `Error: DASHBOARD_USERNAME and DASHBOARD_PASSWORD must be set in production`, exit code 1, nothing listening ✅

**HTTP security tests: 38 of 38 passed.**
| Test | Result |
|---|---|
| Unauthenticated `/`, `/#/income`, `/api/real-deals`, `/api/users`, `/api/real-expenses`, `POST /api/refresh`, `/assets/*.js`, `/aviro-logo.png`, `/api/deal/13358` | **401** + `WWW-Authenticate: Basic realm="AVIRO Finance Dashboard"` ✅ |
| Wrong password, wrong username, empty, password only, `Bearer`, malformed header | **401** ✅ |
| Authenticated `/`, JS asset, favicon, lower-case `basic` scheme | 200 ✅ |
| Authenticated dashboard APIs (7) + `POST /api/refresh` | 200 ✅ |
| Debug endpoints `/api/deal/13358`, `/api/deal-fields`, `/api/deals`, even when authenticated | **404** `{"error":"Not found"}` ✅ |
| Webhook URL, host and code, plus the username and password, in any response body or header | **None** ✅ |

**Browser tests: 19 of 19 passed, 0 page errors.**
| Area | Result |
|---|---|
| Login | Chrome received the `Basic realm="AVIRO Finance Dashboard"` challenge; after login the dashboard loads ✅ |
| Favicon | `<link rel="icon">` = `/aviro-logo.png`, 200 `image/png`, 110,027 bytes; header logo unchanged ✅ |
| Net Revenue | Searchable filter ("ANUJ sury" → Anuj Suryawanshi) ✅, #13358 row ✅, KPIs ✅, charts rendered ✅, pipeline → stage filter ✅, combined filters ✅ |
| Refresh Data | Loading state → one server refresh → "Updated hh:mm"; figures and filters kept ✅ |
| Income | #13358 at ₹1,00,000 ✅; **CSV export** downloaded (2,611 deals including #13358) ✅ |
| Expenses | Deal summary ✅, expense in items table ✅, **CSV export** downloaded with the expense ✅, Reset ✅ |
| Theme | Dark → Light → System ✅ |

**Development workflow:**
- `npm run server` starts on `127.0.0.1` without a login ✅, and the debug endpoints are available there ✅.
- The Vite dev server serves the new favicon ✅.

## 10. Lint and build
- **`npm run lint`:** ✅ passes with no errors.
- **`npm run build`:** ✅ succeeds (`tsc -b` and `vite build`, 963 modules). The existing warning that the JavaScript bundle is over 500 kB (755 kB) is unchanged and is not an error.

## 11. Real Bitrix24 data and Refresh validation
| Item | Expected | Verified (through the login-protected production server) |
|---|---|---|
| Deal #13358 | Dashboard Test Deal - Anuj | ✅ API and all dashboards |
| Income | ₹1,00,000 | ✅ Net Revenue, Income, Expenses |
| Expense #4 | ₹10,000 (`10000\|INR`, linked `D_13358`) | ✅ API, Expenses items table, Net Revenue |
| Net revenue | ₹90,000 | ✅ `+₹90,000` in the Net Revenue row, KPI and Expenses deal summary |
| Margin | 90% | ✅ `90.0%` |
| Refresh Data | Works without a restart | ✅ Button and `POST /api/refresh` both returned 200; one Bitrix24 refresh each (server log `Cache refreshed: 6281 deals, 2 expenses`); same server process throughout |

Nothing was written to Bitrix24 in this pass; all tests were read-only. The Bitrix24 round-trip test (₹10,000 → ₹11,000 → ₹10,000 with Refresh) was done earlier today on the same refresh code and is recorded in `REFRESH-AND-CACHE-REPORT.md`.

## 12. Render configuration
| Setting | Value |
|---|---|
| Service | **Web Service** |
| Runtime | **Node** (version from `package.json` `engines`: `>=22.12.0`) |
| Branch | The branch that contains these changes, **after they're committed and pushed** |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | **Leave empty.** Every path, including `/`, requires the login and returns 401, which Render would treat as unhealthy. With no path, Render checks that the port is open. |
| Environment variables (Secret) | `BITRIX_WEBHOOK_URL`, `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD` |
| Environment variable | `NODE_ENV=production` (optional; `npm start` already sets it; safe with `--include=dev`) |
| Not needed | `PORT` (Render provides it), `HOST` |

## 13. Remaining limitations
1. **Deployment needs a commit and push first.** Nothing is committed yet, and `dist/` is git-ignored, so Render builds it.
2. **Basic Auth is one shared account.**
   - There's no per-user access, no logout (close the browser to sign out) and no lockout after failed attempts. Use a long random password.
   - Credentials are sent with every request, which is safe only over HTTPS; Render provides HTTPS automatically.
3. **Health check:** don't set a health check path on Render (section 12).
4. **Free plan:** the service sleeps after about 15 minutes idle, so the first visit afterwards takes longer (startup plus about 3 s to fill the cache).
5. **In-memory cache per instance:** run a single instance. With several, a Refresh only updates the instance that received it.
6. **Large download:** the browser downloads all deals as about 2.2 MB of uncompressed JSON per visit. Gzip isn't enabled; it would need extra code or a package.
7. **Local servers:** the development API server on port 3001 (PID 99062) is still running the code from before this pass. Development has no login either way; restart it with `npm run server` to pick up the new code.
8. **Leftover local files:** `public/favicon.svg` remains but is no longer referenced.

## Files changed (not committed)
| File | Change |
|---|---|
| `server/index.js` | Production Basic Auth (constant-time check, 401 + challenge, refuses to start without credentials); debug endpoints only outside production. Includes the earlier deployment changes still uncommitted: `0.0.0.0` in production, serving `dist/`, JSON 404 for unknown `/api` paths. |
| `index.html` | Favicon and apple-touch-icon → existing `/aviro-logo.png` |
| `package.json` | `start` script and `engines.node` (from the deployment pass) |
| `.env.example` | **New:** placeholders for all variables, including `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD` |
| `PRODUCTION-SECURITY-REPORT.md` | **New:** this report |
| `REFRESH-AND-CACHE-REPORT.md` | Updated in the earlier refresh pass (still uncommitted) |
