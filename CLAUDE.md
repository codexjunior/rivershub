# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rivers Dental Clinic Staff Dashboard** — a full-stack appointment, patient, and invoice management system for a dental clinic in Accra, Ghana. Hosted on Vercel at `https://rivershub.vercel.app`.

- **Frontend**: Vanilla HTML/CSS/JS (single-page app, no build step, no framework)
- **Backend**: Vercel serverless functions (`/api/*.js`, CommonJS)
- **Database**: Supabase (PostgreSQL), service-role key
- **Integrations**: Google Calendar (appointments), Google Sheets (patient sync mirror), Gmail API (invoice email), mNotify (SMS)
- **Deployment**: Vercel (`vercel.json`); GitHub Actions for nightly reconcile + twice-daily SMS reminders

## Current Project Phase (from `RIVERSHUB_CONTEXT (1).md`)

The repo has **Phase 0–4 applied** (latest: **Phase 4**, 13 Nov 2026). The context file `RIVERSHUB_CONTEXT (1).md` is the **single source of truth** for project state — read it before starting new work. It covers:

- §1–7: Code as of Phase 4 (current code state)
- §8–14: Systems outside the repo, decisions, roadmap, open items
- §15: Additional observations / bugs not yet scheduled

**Phases**: 0 (done) → 1 (done, backend/DB hardening) → 2 (done, frontend split into 12 script files) → 3 (done, UI redesign via `css/theme.css` override + appointment cards + patient detail pane) → 4 (Reports page + `/api/reports` — done; 12 Nov: activity-log rewrite, one row per invoice event; 13 Nov: invoice UI fixes — checkmark icons, print/email amount paid fix) → 5 (SMS expansion — **not started**)

## Development Commands

### Local Development

There is **no build system, bundler, or dev server**. The app runs as static files + serverless functions.

| Task | Command |
|------|---------|
| Serve locally (static) | `npx serve .` or `python3 -m http.server 8000` |
| Run Vercel locally | `npx vercel dev` (requires Vercel CLI + linked project) |
| Install API deps | `cd api && npm install` |
| Check syntax | `node --check api/*.js` |

### Testing

**No test framework is configured.** No linting/formatting either. Code is plain ES6 with shared global scope across `js/*.js` files.

### Environment Variables

Required for local `vercel dev` or production:

| Variable | Purpose |
|----------|---------|
| `DASHBOARD_TOKEN` | Shared secret for dashboard API auth |
| `DASHBOARD_PASSWORD` | Staff password (kept in `currentPassword` + `localStorage["rdDashPassword"]`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account key (JSON string) for Calendar/Sheets/Gmail |
| `GOOGLE_CALENDAR_ID` | Calendar ID for appointments |
| `GOOGLE_SHEET_ID` | Spreadsheet ID for patient sync |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` / `GMAIL_USER` | Gmail OAuth2 for invoice email |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase connection |
| `SYNC_TOKEN` | Separate token for Apps Script → API webhooks (`/api/sync-patient`, `/api/sync-reconcile`) |
| `MNOTIFY_API_KEY` / `MNOTIFY_SENDER_ID` | SMS provider (mNotify) |
| `VERCEL_URL` | Auto-set by Vercel; used by GitHub Actions |

## High-Level Architecture

### Frontend Structure (`index.html` + `/js` + `/css`)

**Script load order** in `index.html` (all classic `<script src>`, shared global scope, **no ES modules**):

1. `config.js` — `API_TOKEN`, `API_BASE=""`, `authHeader()`, `authQuery()`, `PAGE_SIZE=10`, shared state (`allAppointments`, `currentPassword`, `currentPage`)
2. `utils.js` — `escHtml`, `escAttr`, `genderLabel`, `ageCatLabel`, `dateLabel`, `showToast`, `getAccraToday`
3. `acts.js` — `ACT_PRICES`, `ACTS`, `loadMedicalActs()` (on login), Medical Acts manager UI
4. `auth.js` — `attemptLogin`, `doLogout` (+ their button listeners)
5. `nav.js` — `showPage`, drawer open/close, mobile split-pane drag (IIFE at end of file)
6. `appointments.js` — `renderAll()`, `changePage()`, notes edit (event-delegated), `sendManualReminder`, new-appointment modal
7. `patients.js` — `loadPatients()`, `renderPatientList`, `viewPatient(ref)`, `openEditPatientPane`, `submitPatientForm`, `deletePatient`
8. `invoice-list.js` — `renderInvoiceList`, `viewInvoiceHistory`, `markInvoiceFullyPaid`, `deleteInvoice`, `editInvoice`
9. `invoice-form.js` — `invAddActRow`, `invRecalcRow/Totals`, `openInvoiceModal`, submit, event listeners
10. `invoice-print.js` — `invPrint` (A4 print layout with watermark + PAID stamp)
11. `invoice-email.js` — `invEmail` (builds inline-styled HTML, posts to `/api/invoices` `action:"email"`)
12. `reports.js` — Reports page: `loadReport`, `repRenderRows`, `repRenderPager`, `repExport`, `sortRepRows`, wiring
13. `main.js` — **must be last**: saved-password auto-login (`localStorage["rdDashPassword"]`)

**Pages** (markup in `index.html`):
- `#loginScreen` — password gate
- `#page-appointments` — stats bar (Upcoming / Today / This Week), search, refresh, "+ New Appointment", `#apptContent`
- `#page-patients` — `.patients-split`: left list (`#patientListScroll`), mobile drag handle `#splitDragHandle`, right pane `#patientsRight` (detail/edit)
- `#printInvoiceArea` — hidden, filled before `window.print()`
- Modals: `#newApptModal`, `#invoiceModal` (large; header strip, acts table, discount, summary/payment tables, Print/Email/Save), invoice-history modal created dynamically

**CSS**:
- `css/style.css` — full design system (tokens, base, login, shell, appointments, patients, forms, modals, print, toast, responsive). **Source of truth for UI.**
- `css/theme.css` — Phase 3 override layer loaded **after** `style.css`: white sidebar (desktop) / white top bar + drawer (<=860px), lavender page background, tinted KPI cards with SVG icon tiles, soft-depth cards, navy primary buttons, teal active states. Includes appointment-card redesign (Phase 3b) and patient-detail pane + split-pane fixes (Phase 3c). **No JS changes needed for Phase 3.**

### Backend API (`/api`)

All handlers are Vercel serverless functions. Shared middleware: `applyCors()` (origins `rivershub.vercel.app`, `localhost:3000`), `authRequest()` (Bearer header → body → query), `validatePatient()`.

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/appointments` | GET | Upcoming Google Calendar events (5s cache; max 150) |
| `/api/manage` | POST/PUT/DELETE | Create/update/delete Calendar events |
| `/api/patients` | GET/POST/PUT/DELETE | Patient CRUD + Sheets mirroring + reference generation |
| `/api/invoices` | GET/POST/PATCH/PUT/DELETE | Invoice CRUD + history + email |
| `/api/acts` | GET/POST/PUT/DELETE | Medical acts price list (`active=false` soft delete) |
| `/api/sms` | POST | Manual SMS (`{phone,message}`) or cron reminders (`{trigger:"cron"}`) |
| `/api/sync-patient` | POST | Apps Script webhook: upsert patient into Supabase |
| `/api/sync-reconcile` | GET/POST | Nightly Supabase ↔ Sheets reconciliation (`dry_run` supported, `MAX_DELETES=25`) |
| `/api/reports` | GET | Invoice **activity log** (12 Nov 2026 rewrite): one row per `invoice_history` entry (created / updated / payment) with per-entry `payment` delta; filters, totals, CSV export. All filtering done in memory after deriving deltas |

**Auth**: `Authorization: Bearer TOKEN:PASSWORD` (colon-separated, not space). Separate `SYNC_TOKEN` for machine endpoints (`sync-patient`, `sync-reconcile`, `patients?action=next-ref-public`).

### Database Schema (Supabase)

Known tables: `patients`, `invoices`, `invoice_items`, `invoice_history`, `medical_acts` (columns partially confirmed — `invoice_history` and `medical_acts` DDL not yet seen; F5).

**Key function**: `get_next_reference()` — atomic counter on `reference_counters(year_prefix, last_value)`, format `RDC/YY/NNNN`, restarts at `2044` each year (F10).

### GitHub Actions (`.github/workflows`)

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `reconcile.yml` | Daily 02:00 UTC | `POST /api/sync-reconcile` with `SYNC_TOKEN` |
| `reminders.yml` | Daily 13:00 & 18:00 UTC | `POST /api/sms {"trigger":"cron"}` with Bearer `DASHBOARD_TOKEN` |

### Systems outside the repo

- **Google Apps Script** (bound to the Google Sheet / intake Form): `onFormSubmit(e)` — uppercases strings, fetches reference from `/api/patients?action=next-ref-public`, calls `POST /api/sync-patient`. Has its own 3 AM `runReconciliation` as backup to GitHub's 2 AM job. Script not in repo.
- **Supabase**: `patients.reference_number` → `invoices.reference_number` (ON DELETE CASCADE); `invoice_items.invoice_id` → `invoices.id` (ON DELETE CASCADE). DB trigger `on_patient_deleted` / `notify_patient_deleted()` was dropped in Phase 1 (SQL 1b — **to confirm still ran**).

## Pending Fixes & Open Items (read `RIVERSHUB_CONTEXT (1).md` §13 before starting)

These are the known items that still need attention:

| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| **F13** | Low | `style.css` line ~430 `.split-drag-handle{display:none}` sits after the `max-width:860px` media query that sets `display:flex`, so the mobile split-pane handle is hidden. Fix: declare `display:none` default **before** the media query; also forced in `theme.css`. | Applied in working tree, uncommitted; **verify on phone** |
| **F14** | Low | `main.js` was empty and its auto-login lines moved to top of `auth.js`. Put them back in `main.js` (last script), delete from `auth.js`. | Patched files supplied 10 Nov; **to apply** |
| **F15** | Medium | Split-pane dragged inline height survives switch back to desktop, breaking 3-column layout. Fix supplied (Pointer Events, 85% max / 220px min, clear height on leave mobile, CSS `!important` guard). | Supplied 10 Nov; **to apply** |
| **SQL 1b** | — | Confirm `on_patient_deleted` trigger and `notify_patient_deleted()` function dropped | **To confirm** (run two queries, expect 0 rows) |
| **F4** | Medium | Rotate `SYNC_TOKEN` (value was in a chat once) | **Deferred by owner** |

**Open bugs** (§15): mid-day appointments disappear from "Today" count (API only returns "now onward"); password with `:` breaks `authRequest`; credentials in query string for `viewPatient`/`invEmail`; `editInvoice` name lookup fails if patient isn't on current list page; cron SMS can send duplicates; no appointment delete/reschedule from UI; **invoice math fixed**: `invRecalcTotals` now reads from `invPaymentNow` / `invPriorPaid` with real-time balance display.

**Reports rewrite (12 Nov 2026)**:
- Reports now logs every invoice event, not one row per invoice. `invoice_history` stores *cumulative* snapshots, so `payment = amount_paid − previous snapshot's amount_paid` for the same invoice (e.g. 3000 invoice → +2000 → +500 gives three rows).
- Fixed prod 500s: `PGRST200` (`invoice_history` has no FK to `patients`, so `patients(name)` can't be embedded — names are now looked up via `invoices.reference_number`) and `.range is not a function`.
- Totals: Billed = grand_total of *new* invoices in range; Collected = sum of payment deltas in range; Outstanding = latest `amount_remaining` per invoice in range.
- Items come from `invoice_history.snapshot_items` (carried forward when null, e.g. "Marked paid" rows), falling back to live `invoice_items`.
- `sortRepRows()` removed (server sorts newest first); frontend table has Event / Payment / Paid-to-date columns.
- Known limit: whole history is loaded per request (cap 20,000 rows). Deleting an invoice removes it from the log.

**Bugs resolved in an earlier session**:
- Reports page now defaults to "All time" period, showing all invoices from every patient, sorted newest first
- Invoice modal Cancel button added; save event listener restored
- Invoice `invRecalcTotals` now reads from `invPaymentNow` (visible) + `invPriorPaid` (hidden prior paid), with real-time balance update like the discount field
- Invoice `invPayFull` now correctly sets `invPaymentNow` and triggers full recalc
- Reports sorting re-sorts rendered rows by date (newest first) after each load
- API `api/reports.js` correctly embeds `patients.name` so each row shows the patient who owns the invoice

**Bugs resolved (this session)**:
- **Invoice print/email Amount Paid fix**: Print and email now show the current payment being made (`invPaymentNow`) instead of the cumulative total (`invAmountPaid`). Previously paid amount is shown separately as "Previously Paid" when > 0.
- **Invoice action icons**: "Mark Paid" uses checkmark icon (outline → filled teal on click), "History" uses clock icon, "Edit" uses pencil icon — all in invoice list and modal.
- **Appointments "Today" count**: `/api/appointments` now returns full day (00:00–23:59 Accra) instead of "now onward" — mid-day appointments included.
- **Auth token format**: Changed from `TOKEN:PASSWORD` to `TOKEN|PASSWORD` (pipe separator) to allow passwords containing colons.
- **Credentials in query string**: `invEmail` and `editInvoice` now use `Authorization` header via `authHeader()` instead of query params.
- **`editInvoice` name lookup**: Now always fetches patient name from API (primary) instead of relying on `allPatients` (current page only).

## Common Tasks

### Add a New API Endpoint
1. Create `/api/new-endpoint.js` exporting `async function handler(req, res)`
2. Call `applyCors(req, res)` at top; return early if true
3. Call `authRequest(req)` for auth
4. `vercel.json` already routes `api/**/*.js` — no route change needed unless path differs

### Modify Patient Fields
1. Update `SHEET_COLUMNS` and `buildRow()` in `/api/patients.js` and `/api/sync-reconcile.js`
2. Update `validatePatient()` in `/api/_validate.js`
3. Update frontend form in `patients.js` (`openEditPatientPane`)
4. Run reconciliation after deploy

### Add Medical Act
- UI: Patients page → Manage Medical Acts panel → + Add Act
- API: `POST /api/acts` with `{name, price}` (name uppercased)

### Working with the JS Split (Phase 2 structure)
- **No ES modules** — all 12 files share one global scope. Top-level `let`/`const` names must be unique across all files.
- 26 inline `onclick=` handlers tie markup to global function names. Renaming/moving a function requires keeping it global until replaced by `data-action` delegation (planned, not yet done).
- A file starting with `(` (IIFE) must follow a line ending in `;` or `}`.
- Hard-refresh (Ctrl+Shift+R) after JS edits, or add `?v=N` to script URLs.
- `main.js` stays last — auto-login runs at load and needs every other function defined first.

### Phase 3 Styling (`css/theme.css`)
- Theme overrides `style.css` only via class/ID selectors — no markup changes needed except the two sidebar SVG icons and `<link>` to `theme.css`.
- Appointment-card section at end of `theme.css` (Phase 3b) works standalone even if old grid rules in `style.css` are deleted.
- Checkmark icon toggle styles for "Mark Paid" buttons (invoice list + modal) at end of `theme.css` (Phase 4).
- Not yet restyled: inner patient detail/edit panes, invoice modal, print and email layouts, dark mode.

## File Reference Map

```
├── index.html              # Single-page app markup + modals (loads 12 scripts at end of <body>)
├── vercel.json             # Vercel config: functions 30s max; /api/* → function; static; fallback index.html
├── manifest.json           # PWA manifest (theme #0A3A63)
├── package.json            # Root deps: @supabase/supabase-js, googleapis, @vercel/functions; engines.node = 26.x
├── css/
│   ├── style.css           # Full design system (source of truth; 449 lines)
│   └── theme.css           # Phase 3 overrides (sidebar shell, KPI cards, appt cards, patient detail)
├── js/
│   ├── config.js           # API base, token, auth helpers, shared state
│   ├── utils.js            # Escaping, date formatting, toast
│   ├── auth.js             # Login/logout (+ auto-login lines to move to main.js per F14)
│   ├── nav.js              # Page switching, drawer, mobile split-pane drag (IIFE)
│   ├── acts.js             # Medical acts loader + manager UI
│   ├── appointments.js     # Appointments page: list, search, pagination, notes edit, SMS reminders
│   ├── patients.js         # Patients page: list, view, edit, delete, search, submit
│   ├── invoice-list.js     # Invoice table render, history, mark paid (checkmark icon), delete, edit
│   ├── invoice-form.js     # Invoice modal: rows, totals, open, save, real-time balance recalc, checkmark icon
│   ├── invoice-print.js    # invPrint (A4 print + watermark + PAID stamp; shows current payment not cumulative)
│   ├── invoice-email.js    # invEmail (inline HTML → Gmail API; shows current payment not cumulative)
│   ├── reports.js          # Reports page: loadReport, rendering, CSV export, date sorting
│   └── main.js             # Boot: auto-login (MUST be last script; currently empty per F14)
├── api/
│   ├── _auth.js            # authRequest(req): Bearer / body / query auth
│   ├── _cors.js            # applyCors(req,res): shared CORS + OPTIONS
│   ├── _validate.js        # permit(), sanitiseStr(), validatePatient()
│   ├── appointments.js     # GET upcoming Calendar events (5s cache)
│   ├── manage.js           # POST/PUT/DELETE Calendar events
│   ├── patients.js         # CRUD + next-ref + Sheets mirroring (waitUntil)
│   ├── invoices.js         # CRUD + history + email (Gmail API)
│   ├── acts.js             # CRUD for medical_acts (soft delete active=false)
│   ├── sms.js              # Manual SMS + cron reminders (mNotify)
│   ├── sync-patient.js     # Apps Script webhook (SYNC_TOKEN upsert)
│   ├── sync-reconcile.js   # Supabase↔Sheets reconciliation (paginated, MAX_DELETES=25)
│   └── reports.js          # Written; frontend Reports page not built (Phase 4)
├── imgs/rivers_dental_logo.png
├── .github/workflows/
│   ├── reconcile.yml       # Daily 02:00 UTC patient reconciliation
│   └── reminders.yml       # Daily 13:00 & 18:00 UTC SMS reminders
└── RIVERSHUB_CONTEXT (1).md # PROJECT CONTEXT — single source of truth; read before working
```

## Gotchas

- **No build step** — changes to `index.html`, `css/`, `js/` are live on deploy
- **Vercel function timeout**: 30s max
- **Supabase row limit**: 1000 rows/request — any full-table read must paginate with `.range()` (see F12 fix in `sync-reconcile.js`)
- **Google Sheets**: `values.append` is unreliable; use `values.update` at a calculated row index
- **Timezone**: Ghana = UTC+0 year-round; UTC date == Ghana date; display uses `timeZone:"Africa/Accra"`
- **Auth token format**: `Bearer TOKEN|PASSWORD` — pipe-separated (changed 13 Nov); allows passwords containing colons
- **Invoice number** = patient reference number (every invoice for a patient shares it)
- **Medical acts**: `medical_acts` table (id, name unique, price, active); cached in `ACTS`/`ACT_PRICES` on login
- **`patient_share`** always equals row total (no insurance/split logic yet)
- **Invoice `paid`** is derived: `amount_remaining <= 0.005`
- **Single shared staff password** stored in `localStorage`; no per-user accounts, no roles, no audit trail
- **Invoice math is client-trusted**; server doesn't validate totals
- **No tests, no linting, no build step**
