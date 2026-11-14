# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rivers Dental Clinic Staff Dashboard** — a full-stack appointment, patient, and invoice management system for a dental clinic in Accra, Ghana. Hosted on Vercel at `https://rivershub.vercel.app`.

- **Frontend**: Vanilla HTML/CSS/JS (single-page app, no build step, no framework)
- **Backend**: Vercel serverless functions (`/api/*.js`, CommonJS)
- **Database**: Supabase (PostgreSQL), service-role key
- **Integrations**: Google Calendar (appointments), Google Sheets (patient sync mirror), Gmail API (invoice email), mNotify (SMS)
- **Deployment**: Vercel (`vercel.json`); GitHub Actions for nightly reconcile + twice-daily SMS reminders

## Current Project Phase (based on actual codebase files)

The codebase is at **Phase 5** (November 2026), confirmed by files present:
- `js/` has 16 scripts including `acts-page.js`, `reminders-page.js`, `sms.js` (no separate medical acts/reminders pages)
- `.github/workflows/` has `reconcile.yml`, `reminders.yml`, and all five SMS workflows (birthday, holiday, review, followup)
- `api/sms.js` endpoint exists for manual SMS and cron triggers
- SMS opt-out checkboxes in patients form, medical acts recall/months columns implemented
- `@reminders-page.js` and `@acts-page.js` scripts (June), single-page app structure with `sms.js` (June)

**Phases completed**:
- 0 + 1: Backend/DB hardening, reference counter, Sheets mirroring via waitUntil, trimmed deps, shared CORS, atomic counter
- 2: Frontend split into 12 script files (js/config, utils, acts, auth, nav, appointments, patients, invoice-list, invoice-form, invoice-print, invoice-email, reports) + main.js auto-login
- 3: UI redesign via `css/theme.css` override (sidebar/top-bar, KPI cards, appointment cards, patient detail pane), split-pane fix F15
- 4: Reports page + `/api/reports` endpoint with invoice activity-log rewrite (one row per invoice event), checkmark icons, print & email amount-paid fix, rep-procedures text wrap on mobile
- 5: SMS expansion (NOT FULLY INTEGRATED): `api/sms.js` endpoint exists (manual SMS + cron triggers birthday/holiday/review/followup), SMS workflows exist (8:00 UTC each), schema additions present (`patients.sms_optouts`, `medical_acts.recall_months`, `holidays` pending DDL), opt-out checkboxes UI implemented in patients form, `@reminders-page.js` and `@acts-page.js` scripts exist but are side-modules (not in main page routing yet)

**Pending fixes applied**:
- F13: `.split-drag-handle` fix (forced in `theme.css`)
- F14: auto-login moved to `main.js` (last script)
- F15: Pointer Events split-pane (85% max / 220px min, clear on layout change)

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

## Environment Variables

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
2. `utils.js` — `escHtml`, `escAttr`, `genderLabel`, `ageCatLabel`, `dateLabel`, `showToast`, `getAccraToday`, `titleCase()` (Phase 5)
3. `acts.js` — `ACT_PRICES`, `ACTS`, `loadMedicalActs()` (on login), Medical Acts manager UI, recall intervals column (Phase 5)
4. `auth.js` — `attemptLogin`, `doLogout` (+ their button listeners)
5. `nav.js` — `showPage`, drawer open/close, mobile split-pane drag (IIFE at end of file)
6. `appointments.js` — `renderAll()`, `changePage()`, notes edit (event-delegated), `sendManualReminder`, new-appointment modal
7. `patients.js` — `loadPatients()`, `renderPatientList`, `viewPatient(ref)`, `openEditPatientPane`, `submitPatientForm`, `deletePatient`, SMS opt-out checkboxes (Phase 5)
8. `invoice-list.js` — `renderInvoiceList`, `viewInvoiceHistory`, `markInvoiceFullyPaid`, `deleteInvoice`, `editInvoice`
9. `invoice-form.js` — `invAddActRow`, `invRecalcRow/Totals`, `openInvoiceModal`, submit, event listeners
10. `invoice-print.js` — `invPrint` (A4 print layout with watermark + PAID stamp)
11. `invoice-email.js` — `invEmail` (builds inline-styled HTML, posts to `/api/invoices` `action:"email"`)
12. `reports.js` — Reports page: `loadReport`, `repRenderRows`, `repRenderPager`, `repExport`, `sortRepRows`, wiring
13. `sms.js` — **Phase 5**: SMS page (SMS log table, opt-out management, review/followup history), `loadSMSLog()`, `renderSMSLog()`, `manageSMSOptouts()`
14. `main.js` — **must be last**: saved-password auto-login (`localStorage["rdDashPassword"]`)

**Pages** (markup in `index.html`):
- `#loginScreen` — password gate
- `#page-appointments` — stats bar (Upcoming / Today / This Week), search, refresh, "+ New Appointment", `#apptContent`
- `#page-patients` — `.patients-split`: left list (`#patientListScroll`), mobile drag handle `#splitDragHandle`, right pane `#patientsRight` (detail/edit)
- `#printInvoiceArea` — hidden, filled before `window.print()`
- Modals: `#newApptModal`, `#invoiceModal` (large; header strip, acts table, discount, summary/payment tables, Print/Email/Save), invoice-history modal created dynamically

**CSS**:
- `css/style.css` — full design system (tokens, base, login, shell, appointments, patients, forms, modals, print, toast, responsive). **Source of truth for UI.**
- `css/theme.css` — Phase 3 / 3b / 3c theme + Phase 4 Reports block (~266 lines), loaded AFTER `style.css`. Includes appointment-card redesign, patient-detail pane + split-pane fixes (F15), Reports table on desktop and stacked cards on phones, procedure highlight, paid/partial/unpaid badges.

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

**Auth**: `Authorization: Bearer TOKEN|PASSWORD` (pipe-separated, not space; changed 13 Nov). Separate `SYNC_TOKEN` for machine endpoints (`sync-patient`, `sync-reconcile`, `patients?action=next-ref-public`).

### Database Schema (Supabase)

Known tables (plus Phase 4 confirm): `patients`, `invoices`, `invoice_items`, `invoice_history`, `medical_acts`. Optional later additions for Phase 5 include SMS opt-out columns, recall intervals, holidays table, sms_log table (see context file for DDL).

**Key function**: `get_next_reference()` — atomic counter on `reference_counters(year_prefix, last_value)`, format `RDC/YY/NNNN`, restarts at `2044` each year.

### GitHub Actions (`.github/workflows`)

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `reconcile.yml` | Daily 02:00 UTC | `POST /api/sync-reconcile` with `SYNC_TOKEN` |
| `reminders.yml` | Daily 13:00 & 18:00 UTC | Appointment reminders (`trigger:"cron"`) |
| `sms-birthday.yml` | Daily 08:00 UTC | Birthday SMS (`trigger:"birthday"`) |
| `sms-holiday.yml` | Daily 08:00 UTC | Holiday greetings (`trigger:"holiday"`) |
| `sms-review.yml` | Daily 08:00 UTC | Review/Recall reminders (`trigger:"review"`) |
| `sms-followup.yml` | Daily 08:00 UTC | Follow-up retention SMS (`trigger:"followup"`) |

### Systems outside the repo

- **Google Apps Script** (bound to the Google Sheet / intake Form): `onFormSubmit(e)` — uppercases strings, fetches reference from `/api/patients?action=next-ref-public`, calls `POST /api/sync-patient`. Has its own 3 AM `runReconciliation` as backup to GitHub's 2 AM job. Script not in repo.
- **Supabase**: `patients.reference_number` → `invoices.reference_number` (ON DELETE CASCADE); `invoice_items.invoice_id` → `invoices.id` (ON DELETE CASCADE). DB trigger `on_patient_deleted` / `notify_patient_deleted()` was dropped in Phase 1 (SQL 1b — **confirmed 0 rows**).
- **D6 recall months** (Phase 5 spec, not implemented yet): The `medical_acts.recall_months` column would ship dormant (null). Staff would fill it via the Acts manager. Null = no recall for that act. No backlog blast — review reminders sent only when due date lands in next 7 days.

## Pending Fixes & Open Items

**All Phase 1–4 fixes resolved** (based on actual codebase verification):

| ID | Severity | Summary | Status |
|----|----------|---------|--------|
| ~~F13~~ | Low | ~~`.split-drag-handle` CSS rule ordering bug~~ | **Fixed** (applied in `theme.css`, line ~430) |
| ~~F14~~ | Low | ~~`main.js` empty, auto-login in `auth.js`~~ | **Fixed** (auto-login in `main.js` last script) |
| ~~F15~~ | Medium | ~~Split-pane dragged inline height persisted to desktop~~ | **Fixed** (Pointer Events IIFE in `nav.js`, 85% max / 220px min, `theme.css` guard) |
| ~~SQL 1b~~ | — | ~~Confirm `on_patient_deleted` trigger dropped~~ | **Confirmed** (0 rows from `pg_trigger` and `pg_proc`) |
| ~~F4~~ | Medium | ~~Rotate `SYNC_TOKEN` (value was in a chat)~~ | **Deferred by owner** (still in GitHub secret and Apps Script) |

**Post-Phase 4 open bugs** (to be scheduled in Phase 5 or later):
1. Appointment list only returns events from "now onward" → appointments today before API call time disappear from "Today" count (needs API change).
2. Password with `:` still breaks `authRequest` (old sessions use `:`; new login uses `|`).
3. `invEmail` and `editInvoice` still send credentials in URL query string (should use header).
4. Cron SMS can send duplicates (same appointment appears twice, 13:00 + 18:00) (dedupe key needed).
5. No appointment delete/reschedule from the UI.
6. Invoice math is client-side, server doesn't validate totals.
7. No per-user authentication or audit trail (invoice history lacks "who").
8. Reports procedures column (`rep-procedures`) has inline `nowrap` (fixed by `theme.css` media query on mobile).

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
- **No ES modules** — all 13 files share one global scope. Top-level `let`/`const` names must be unique across all files.
- 26 inline `onclick=` handlers tie markup to global function names. Renaming/moving a function requires keeping it global until replaced by `data-action` delegation (planned, not yet done).
- A file starting with `(` (IIFE) must follow a line ending in `;` or `}`.
- Hard-refresh (Ctrl+Shift+R) after JS edits, or add `?v=N` to script URLs.
- `main.js` stays last — auto-login runs at load and needs every other function defined first.

### Phase 3 Styling (`css/theme.css`)
- Theme overrides `style.css` only via class/ID selectors — no markup changes needed except the two sidebar SVG icons and `<link>` to `theme.css`.
- Appointment-card section at end of `theme.css` (Phase 3b) works standalone even if old grid rules in `style.css` are deleted.
- Checkmark icon toggle styles for "Mark Paid" buttons (invoice list + modal) at end of `theme.css` (Phase 4).
- Reports table on desktop and stacked cards on phones (Phase 4).
- Rep-procedures text wrap on mobile (Phase 4): `.rep-procedures{text-wrap: wrap !important}` at `max-width:860px` breakpoint.

## File Reference Map

```
├── index.html              # Single-page app markup + modals (loads 13 scripts at end of <body>)
├── vercel.json             # Vercel config: functions 30s max; /api/* → function; static; fallback index.html
├── manifest.json           # PWA manifest (theme #0A3A63)
├── package.json            # Root deps: @supabase/supabase-js, googleapis, @vercel/functions; engines.node = 26.x
├── css/
│   ├── style.css           # Full design system (source of truth; 377 lines)
│   └── theme.css           # Phase 3 overrides (sidebar shell, KPI cards, appt cards, patient detail) + Phase 4 Reports block
├── js/
│   ├── config.js           # API base, token, auth helpers, shared state
│   ├── utils.js            # Escaping, date formatting, toast
│   ├── acts.js             # Medical acts loader + manager UI
│   ├── auth.js             # Login/logout (+ auto-login lines to move to main.js per F14)
│   ├── nav.js              # Page switching, drawer, mobile split-pane drag (IIFE)
│   ├── appointments.js     # Appointments page: list, search, pagination, notes edit, SMS reminders
│   ├── patients.js         # Patients page: list, view, edit, delete, search, submit
│   ├── invoice-list.js     # Invoice table render, history, mark paid (checkmark icon), delete, edit
│   ├── invoice-form.js     # Invoice modal: rows, totals, open, save, real-time balance recalc, checkmark icon
│   ├── invoice-print.js    # invPrint (A4 print + watermark + PAID stamp; shows current payment not cumulative)
│   ├── invoice-email.js    # invEmail (inline HTML → Gmail API; shows current payment not cumulative)
│   ├── reports.js          # Reports page: loadReport, rendering, CSV export, date sorting, mobile stacking
│   └── main.js             # Boot: auto-login (MUST be last script)
├── api/
│   ├── _auth.js            # authRequest(req): Bearer / body / query auth
│   ├── _cors.js            # applyCors(req,res): shared CORS + OPTIONS
│   ├── _validate.js        # permit(), sanitiseStr(), validatePatient()
│   ├── appointments.js     # GET upcoming Calendar events (5s cache)
│   ├── manage.js           # POST/PUT/DELETE Calendar events
│   ├── patients.js         # CRUD + next-ref + Sheets mirroring (waitUntil)
│   ├── invoices.js         # CRUD + history + email (Gmail API)
│   ├── acts.js             # CRUD for medical_acts (soft delete active=false)
│   ├── sms.js              # **Phase 5**: Manual SMS, appointment/birthday/holiday/review/followup cron triggers
│   ├── sync-patient.js     # Apps Script webhook (SYNC_TOKEN upsert)
│   ├── sync-reconcile.js   # Supabase↔Sheets reconciliation (paginated, MAX_DELETES=25)
│   └── reports.js          # GET invoice activity log + CSV export
├── sql/
│   └── 05-phase5-sms-expansion.sql  # **Phase 5**: Adds `medical_acts.review_months`
├── imgs/rivers_dental_logo.png
├── .github/workflows/
│   ├── reconcile.yml       # Daily 02:00 UTC patient reconciliation
│   ├── reminders.yml       # Daily 13:00 & 18:00 UTC appointment reminders
│   ├── sms-birthday.yml    # **Phase 5**: Daily 08:00 UTC birthday SMS
│   ├── sms-holiday.yml     # **Phase 5**: Daily 08:00 UTC holiday greetings
│   ├── sms-review.yml      # **Phase 5**: Daily 08:00 UTC review/recall reminders
│   └── sms-followup.yml    # **Phase 5**: Daily 08:00 UTC follow-up retention SMS
└── RIVERSHUB_CONTEXT (1).md # ORIGINAL SPEC DOCUMENT — Phase 5 design notes, not in repo codebase
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