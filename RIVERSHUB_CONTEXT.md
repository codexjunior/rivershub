# RiversHub — Codebase Context

Repo: `codexjunior/rivershub` (branch `main`) · Staff dashboard for **Rivers Dental Clinic** (Taifa, Accra, Ghana).
Snapshot: repo zip uploaded 10 Nov 2026 = HEAD `6fa675a` ("major update is css theme", three theme commits) **plus working-tree changes**. Starting point was `515bd55`. Phases 1–4 are applied and marked *(Phase N)* below; **Phase 4 files were supplied 10 Nov 2026 and still need to be copied into the repo and deployed (§13)**. See §12–§14.

> **How to read this file:** §1–7 describe the code **as of Phase 4 (10 Nov 2026): written against `515bd55` and updated wherever Phases 1–4 changed it**. §8–14 hold everything outside the repo plus the **agreed decisions, fixes, designs and roadmap**. Where they differ, §9–12 describe the target.

---

## 1. What it is

An internal, staff-only web app (installable as a PWA, "RDC Staff") for:
1. Viewing / creating / annotating **appointments** (stored in Google Calendar)
2. Managing **patient records** (Supabase is source of truth, mirrored to Google Sheets)
3. Creating / editing / printing / emailing **invoices** (Supabase)
4. Managing the **medical acts (procedures) price list** (Supabase)
5. Sending **SMS reminders** (mNotify), manually and via a daily cron

Hosted on **Vercel** (migrated from Render: commit "Migrate from Render to Vercel serverless"). Public origin: `https://rivershub.vercel.app`. The clinic's public website is a separate project (`riversdentalclinic.vercel.app`) which creates website bookings in the same Google Calendar.

---

## 2. Stack & file map

| Layer | Tech |
|---|---|
| Frontend | Single-page, vanilla JS/HTML/CSS. **No framework, no build step.** |
| Backend | Vercel serverless functions (`/api/*.js`, CommonJS, 30s max; Node: root `package.json` pins `26.x`, `api/package.json` says `>=18.x`) |
| DB | Supabase (Postgres) via `@supabase/supabase-js`, service-role key |
| Calendar | Google Calendar API via service account (`googleapis`) |
| Sheets | Google Sheets API (tab `Patient_data`) |
| Email | Gmail API (OAuth2 refresh token), not SMTP |
| SMS | mNotify REST API |
| Cron | GitHub Actions (`.github/workflows`) |
| Fonts | Plus Jakarta Sans (used); Libre Baskerville is imported but **unused** |

```
/
├─ index.html            ~339 lines. Markup only (sidebar + drawer nav, 3 pages incl. Reports, modals); loads the 13 scripts below at the end of <body>
├─ js/                   plain classic scripts: no ES modules, no build step, ONE shared global scope (Phase 2)
│  ├─ config.js          API_TOKEN, API_BASE, authHeader/authQuery, PAGE_SIZE, shared state (allAppointments, currentPassword, currentPage)
│  ├─ utils.js           escHtml, escAttr, genderLabel, ageCatLabel, dateLabel, showToast, getAccraToday
│  ├─ acts.js            ACT_PRICES, ACTS, loadMedicalActs + the Medical Acts manager
│  ├─ auth.js            attemptLogin, doLogout + their button listeners
│  ├─ nav.js             split-pane drag (Pointer Events IIFE at the top of the file, F15), showPage, drawer
│  ├─ appointments.js    sendManualReminder, new-appointment modal, notes edit, renderAll, changePage
│  ├─ patients.js        list, view, edit, delete, submit, search
│  ├─ invoice-list.js    renderInvoiceList, history, mark paid, delete, edit
│  ├─ invoice-form.js    invoice modal: rows, totals, open, save
│  ├─ invoice-print.js   invPrint
│  ├─ invoice-email.js   invEmail
│  ├─ reports.js         Reports page (Phase 4): filters, KPI totals, table / phone cards, pagination, CSV export, click-through to the patient
│  └─ main.js            saved-password auto-login (runs at load, so it MUST be the last script; restored here 10 Nov, see F14)
├─ css/style.css        456 lines. Base styles incl. print + responsive (moved into css/; the theme overrides it)
├─ css/theme.css        Phase 3 / 3b / 3c theme + Phase 4 Reports block (~266 lines), loaded AFTER style.css
├─ manifest.json         PWA manifest (theme #0A3A63)
├─ vercel.json           routes: /api/* → function; static assets; everything else → index.html
├─ package.json          root deps: @supabase/supabase-js, googleapis, @vercel/functions; `engines.node` = `26.x`
├─ imgs/rivers_dental_logo.png
├─ api/
│  ├─ _auth.js           authRequest(req)
│  ├─ _cors.js           applyCors(req,res): shared CORS + OPTIONS handling (Phase 1)
│  ├─ _validate.js       permit(), sanitiseStr(), validatePatient()
│  ├─ appointments.js    GET upcoming events from Calendar (5s cache)
│  ├─ manage.js          POST/PUT/DELETE Calendar events
│  ├─ patients.js        CRUD + next-ref + Sheets mirroring
│  ├─ invoices.js        CRUD + history + email
│  ├─ acts.js            CRUD for medical_acts price list
│  ├─ reports.js         GET read-only invoice report + CSV export (Phase 4)
│  ├─ sms.js             manual SMS + cron reminders
│  ├─ sync-patient.js    inbound webhook (Google Apps Script → Supabase)
│  ├─ sync-reconcile.js  Supabase↔Sheets reconciliation
│  └─ package.json       Trimmed (Phase 1): supabase-js, googleapis, @vercel/functions
└─ .github/workflows/
   ├─ reminders.yml      cron 13:00 & 18:00 UTC → POST /api/sms {"trigger":"cron"}
   └─ reconcile.yml      cron 02:00 UTC → POST /api/sync-reconcile
```

Ghana is UTC+0 year-round; code relies on this (UTC date == Ghana date), while display uses `timeZone:"Africa/Accra"`.

---

## 3. Environment variables (inferred)

`DASHBOARD_TOKEN`, `DASHBOARD_PASSWORD`, `SYNC_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SHEET_ID`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER`, `MNOTIFY_API_KEY`, `MNOTIFY_SENDER_ID` (default `RiversDent`).
GitHub secrets: `VERCEL_URL`, `DASHBOARD_TOKEN`, `SYNC_TOKEN`.

---

## 4. Auth model

- One **shared staff password**; no user accounts, no roles, no per-user audit.
- Frontend hardcodes `API_TOKEN = "rivers-dental-staff"` (= `DASHBOARD_TOKEN`). Password typed at login is kept in `currentPassword` and in **`localStorage["rdDashPassword"]`** (auto-login on reload).
- `authRequest(req)` accepts, in order: `Authorization: Bearer TOKEN:PASSWORD` → body `{token,password}` → query `?token=&password=`.
- Login check = a GET to `/api/appointments`; 200 means password OK.
- Separate `SYNC_TOKEN` for machine endpoints (`sync-patient`, `sync-reconcile`, `patients?action=next-ref-public`).
- Cron SMS uses `Authorization: Bearer <DASHBOARD_TOKEN>` only (no password).

---

## 5. Backend API reference

All handlers set CORS (`rivershub.vercel.app`, `localhost:3000`) and handle `OPTIONS` through the shared `applyCors()` in `api/_cors.js` *(Phase 1)*, and return JSON. Requests with no `Origin` header (curl, GitHub cron) get `*`.

### `/api/appointments` — GET
Lists Google Calendar events from **now onward** (max 150, `singleEvents`, ordered by start). 5-second in-memory cache, invalidated by `manage.js`.
Parses event `description` with line regexes: `Patient:`, `Service:`, `Email:`, `Phone:`, (`Booked via:` ignored); everything else = free-text notes (HTML stripped/entities decoded).
Returns `{appointments:[{id,title,isWebBooking,patient,service,email,phone,notes,date,time,timeEnd,dateRaw}], total}`.
`isWebBooking = !!service` (only the website writes a `Service:` line).

### `/api/manage` — POST / PUT / DELETE (Calendar write)
- **POST** create: `{name,phone,email,date(YYYY-MM-DD),time(HH:MM),duration,description}`. Start built as `${date}T${time}:00Z` (UTC = Ghana). `duration` accepts `"30"`, `"1:30"`; default 60 min. Writes description as `Patient:/Phone:/Email:` header + blank line + notes. Event title = patient name, fixed location (clinic address), 30-min popup reminder.
- **PUT** update notes: `{eventId, description}`. Preserves header lines (`Patient/Phone/Email/Service/Booked via`), appends `--- Notes ---` + new notes. For manual events (no header) replaces description.
- **DELETE** `{eventId}` — exists in API; **no UI uses it**.

### `/api/patients`
- **GET** `?action=next-ref-public&sync_token=` → `{reference}` (for Apps Script)
- **GET** `?action=next-ref` → `{reference}` via Postgres RPC `get_next_reference` (format `RDC/YY/NNNN`, e.g. `RDC/26/2044`; **atomic counter table `reference_counters`** *(Phase 1, SQL 1a)*, never reuses a number)
- **GET** `?ref=RDC/26/001` → `{patient}` (all columns)
- **GET** `?page=&limit=(≤50)&search=` → `{patients,total,page,limit}`; list columns only: `reference_number,name,phone,gender,age_category,created_at`; search = name `ilike %x%`, reference/phone `ilike x%`; ordered `created_at desc`.
- **POST** create *(Phase 1)*: ref is assigned **at save** by the server if absent → `validatePatient` → Supabase **insert** (a duplicate ref returns **409** and never overwrites; an auto-assigned ref that collides is retried up to 3 times) → `syncToSheets(isNew=true)` via `waitUntil`.
- **PUT** update by `reference_number` → validate → update → `syncToSheets(false)` via `waitUntil`.
- **DELETE** `{reference_number}` → Supabase delete (invoices assumed to cascade — UI warns they're deleted) → `deleteFromSheets` via `waitUntil` *(Phase 1: the TDZ bug is fixed, so the row is now removed from Sheets immediately)*.
- Sheets writes use `background()` in `patients.js`: `waitUntil` from `@vercel/functions` when it loads, otherwise a plain `await` fallback (slower but safe).

Patient fields: `reference_number, name, gender(0 M/1 F), age_category(0 child/1 teen/2 adult/3 senior), phone, whatsapp, birthdate, email, city, company, profession, emergency_contact_{name,relation,phone}, allergies, notes, created_at`.
Sheets columns A–O: `Timestamp | Reference | Name | Gender | AgeCat | Phone | WhatsApp | Birthdate | Email | City | Company | Profession | EmergName | EmergRelation | EmergPhone`. **`allergies` and `notes` are not mirrored to Sheets.**

### `/api/invoices`
- **GET** `?ref=` → `{invoices:[…, invoice_items[]], total, unpaid}` (ordered date desc)
- **GET** `?history=INVOICE_ID` → `{history}` from `invoice_history`
- **POST** create `{reference_number,date,items[],…fields}` → insert `invoices` + `invoice_items` + history row "Invoice created"
- **POST** `{action:"email",to,invoiceHtml,invoiceNumber}` → Gmail API send (raw RFC-2822, subject `Invoice #N, Rivers Dental Clinic`)
- **PATCH** edit `{id,items[],…fields}` → update header, **delete all items & re-insert**, write history ("Marked as fully paid" if `paid`, else "Invoice updated")
- **PUT** `{id,paid}` → toggles paid (sets paid=grand_total/remaining=0 when true) — **frontend doesn't use it**, uses PATCH instead
- **DELETE** `{id}` → delete invoice (no history entry)

Tables: `invoices` (id, reference_number, invoice_number, date, discount_pct, discount_amount, subtotal, grand_total, amount_paid, amount_remaining, paid), `invoice_items` (invoice_id, procedure, qty, unit_price, total_price, patient_share), `invoice_history` (invoice_id, grand_total, amount_paid, amount_remaining, discount_amount, paid, note, snapshot_items, changed_at). Totals are computed **client-side**; server trusts them.

### `/api/acts` — price list (`medical_acts`: id, name, price, active)
GET active acts (by name) · POST add (name uppercased) · PUT update · DELETE = **soft delete** (`active=false`).

### `/api/reports` — GET *(Phase 4, read-only)*
`?from=YYYY-MM-DD&to=YYYY-MM-DD&status=all|paid|unpaid|partial&procedure=TEXT&q=TEXT&page=1&limit=25&totals=1` · auth: `Authorization: Bearer TOKEN:PASSWORD`.
- Returns `{rows,total,page,limit[,totals][,warning]}`. Each row: `id,date,reference_number,name,items[{procedure,qty,total_price}],subtotal,discount_amount,grand_total,amount_paid,amount_remaining,status` (`status` = paid | partial | unpaid). Sorted by date desc; `limit` clamped 5–50.
- `totals=1` adds `{count,billed,collected,outstanding}` over the **whole filtered set** (read in 1000-row chunks because of the Supabase cap, F12; safety stop at 20,000 rows). With a procedure filter it also returns `totals.procedure = {lines,qty,subtotal}` for the matching lines only.
- `procedure` = case-insensitive contains on `invoice_items.procedure` (inner join, so only invoices with a matching line); the row still lists **all** its items. `q` = patient name contains, or reference prefix (max 300 matching patients, `warning` if cut). Filter text is stripped of `% * , ( ) " \` before it reaches PostgREST.
- `&export=csv` returns every matching invoice as CSV (formula-injection guarded: cells starting `= + - @` get a leading `'`).
- Status rules: paid = `paid` true; partial = not paid and `amount_paid` > 0; unpaid = not paid and `amount_paid` ≤ 0.
- Tested with a mock-Supabase harness (16/16 checks) and, on the front end, with a stubbed API in headless Chrome.

### `/api/sms` — POST
- **Cron** `{trigger:"cron"}` + Bearer DASHBOARD_TOKEN: fetch tomorrow's (UTC-day) calendar events, extract `Phone:`/`Patient:` from description, send mNotify SMS, 300 ms gap. Skips events without a phone. Returns `{sent,skipped,failed,date}`.
- **Manual** `{phone,message}` + dashboard auth. Phone normalised (`0xxx`→`233xxx`, strip `+`, spaces).
- Cron message: "Hello {name}, this is a reminder that your appointment is scheduled for {YYYY-MM-DD} at {time}. Please call 030 244 8742 if you would like to reschedule."

### `/api/sync-patient` — POST (SYNC_TOKEN)
Unchanged in Phase 1 (still an upsert; only the CORS helper was swapped in). Called by a **Google Apps Script** (not in repo) when the patient intake Google Form is submitted → upserts patient into Supabase. Does not use `validatePatient`.

### `/api/sync-reconcile` — GET/POST (SYNC_TOKEN)
Compares Supabase vs `Patient_data` sheet by reference. Supabase wins: rows only in Sheets are deleted, rows only in Supabase are added. `dry_run` supported. Run nightly 02:00 (GitHub Actions).
*(Fixed 9 Nov 2026, F12)*: reads Supabase **page by page** (`fetchAllPatients`, 1000 per page, ordered by reference) and cross-checks the count against Supabase's own `count` (aborts with a 500 if they differ); refuses to delete more than `MAX_DELETES = 25` Sheet rows unless `force=true` (409 `aborted_too_many_deletions`); adds missing rows with an explicit `values.update` at the true next empty row (`sheetRows.length - rowsToDelete.length + 1`) instead of `values.append`.

### Data-flow summary
```
Intake Google Form ─(Apps Script)→ /api/sync-patient → Supabase ─┐
Dashboard patient CRUD ─→ /api/patients → Supabase ──async──→ Google Sheet (Patient_data)
                                              ↑ nightly /api/sync-reconcile fixes drift
Website booking / Dashboard "New Appointment" → Google Calendar ←→ /api/appointments, /api/manage
Calendar (tomorrow) ─cron 13:00 & 18:00─→ /api/sms → mNotify
Invoices ─→ /api/invoices → Supabase; email via Gmail API
```

---

## 6. Frontend structure (`index.html`)

### Markup (lines 1–272)
- `#loginScreen` — card with logo, password field, "Access Dashboard".
- `#app` (`display:none` until login) containing:
  - `.nav` top bar (brand, links `Appointments` / `Patients` / `Reports`, Sign Out, hamburger; since Phase 3 it is the white **sidebar** on desktop and the top bar on phones) + mobile `.drawer`.
  - `#page-appointments` — stats bar (Upcoming / Today / This Week), search + refresh + "+ New Appointment", `#apptContent` list.
  - `#page-patients` — `.patients-split`: left list (`#patientListScroll`, search, "+ New", pagination), mobile drag handle `#splitDragHandle`, right pane `#patientsRight` (detail/edit view).
  - `#page-reports` *(Phase 4)* — KPI cards (Billed / Collected / Outstanding, GHS), filter card (period preset, from, to, status, procedure with datalist from `ACTS`, patient search, Reset, Export CSV), `#repSummary` (count, procedure subtotal, warning), `#repContent` (table on desktop, stacked cards ≤860px), `#repPagination`.
- `#printInvoiceArea` — hidden; filled just before `window.print()`.
- Modals: `#newApptModal`, `#invoiceModal` (large, header strip w/ logo, acts table, discount, summary/payment tables, Print/Email/Save). Invoice-history modal is created dynamically.
- `#toast`.

### JS (since Phase 2: now 13 plain scripts in `js/`, one shared global scope, inline `onclick=` handlers; file map in §2)
*Script order in `index.html`:* config, utils, acts, auth, nav, appointments, patients, invoice-list, invoice-form, invoice-print, invoice-email, **reports** *(Phase 4)*, **main (last)**.
*Rules for working with these files:* use classic `<script src>` only (ES modules would break the 26 inline handlers); `main.js` stays last because the auto-login runs at load and needs every function defined (F14: the lines had drifted into the top of `auth.js`, where they could run before `renderAll` etc. existed; moved back); a file that starts with `(` (an IIFE) must follow a line ending in `;` or `}`; top-level `let`/`const` names must be unique across all files; hard-refresh (Ctrl+Shift+R) after JS edits, or add `?v=N` to the script URLs.
| Area | Key functions / state |
|---|---|
| Config | `API_TOKEN`, `API_BASE=""`, `authHeader()`, `authQuery()`, `PAGE_SIZE=10` (appts), `PATIENT_LIMIT=20` |
| Helpers | `escHtml`, `escAttr`, `genderLabel`, `ageCatLabel`, `dateLabel`, `showToast`, `getAccraToday` |
| Auth | `attemptLogin`, `doLogout` (auto-login from localStorage on load) |
| Nav | `showPage`, drawer open/close; patients lazily loaded on first visit |
| Appointments | `allAppointments`, `renderAll()` (filter by title, group by date, paginate, stats), `changePage`, inline **notes edit** (event-delegated), `sendManualReminder` (confirm() → `/api/sms`), new-appointment modal |
| Patients | `allPatients`, `loadPatients(page,search)` (400 ms debounce), `renderPatientList`, `viewPatient(ref)` (fetches patient + invoices in parallel, renders detail), `openEditPatientPane`, `submitPatientForm` (uppercases all text/email inputs), `deletePatient` |
| Invoices | `renderInvoiceList`, `viewInvoiceHistory`, `markInvoiceFullyPaid` (PATCH), `deleteInvoice`, `editInvoice`, `openInvoiceModal`, `invAddActRow`, `invRecalcRow/Totals`, `invPrint`, `invEmail` |
| Acts | `ACT_PRICES`, `ACTS`, `loadMedicalActs` (on login), `toggleActsManager`, `renderActsList`, `saveNewAct`, `updateAct`, `deleteAct` |
| Mobile | Draggable split-pane in `nav.js` (Pointer Events, <=860px). The list can grow to **85%** of the split area (min 220px, same as the CSS). **Leaving the mobile layout clears the dragged inline height** (matchMedia `change` + `resize`), and `theme.css` forces `.patients-left{height:auto!important}` at >=861px as a second guard (F15) |

Behaviours worth remembering:
- Appointment cards show the **start time only** (`a.timeEnd` is still returned by the API but no longer displayed). Card buttons: `Remind` (shown only when the event has a phone) and `Edit notes` (no icon). The "Today" group header has no emoji.
- New-patient form *(Phase 1)*: the Reference field is read-only and shows the placeholder "Assigned on save" (the dashboard no longer calls `action=next-ref`). After a successful create the app opens the new patient's page, so a second click cannot create a duplicate.
- Invoice number = patient reference number (every invoice for a patient shares it).
- `patient_share` always equals the row total (no insurance/split logic yet).
- Selecting an act auto-fills unit price unless the user typed one manually (`data-manual`).
- Invoice `paid` is derived: `remaining <= 0.005`.
- Print builds a clean A4 layout with logo watermark and "✓ PAID" stamp; waits for logo load (1.5 s fallback).
- Email builds a separate inline-styled HTML invoice client-side and posts it to the API; falls back to `prompt()` if the patient has no email.
- "Manage Medical Acts" panel lives inside the patient detail pane (odd placement, a global setting).
- Uses `confirm()` / `prompt()` for several flows; emoji used as icons (📅 👤 🦷 ⏳ ⚠️ ✏️ ⚙️) and in toasts (✅).

---

## 7. Styling (`style.css` + `css/theme.css`)

**Phase 3 (10 Nov 2026): `css/theme.css`** is loaded after `style.css` and overrides it. No class names or IDs changed, so the JS is untouched. Direction (from the Cliniva reference, with Plusadmin for structure): white **left sidebar** (brand, Appointments, Patients, Sign Out) on desktop that becomes a **white top bar + hamburger drawer** at <=860px; cool lavender page (`--bg #EDF1F9`); three **tinted KPI cards** (Upcoming blue, Today teal, This Week amber) with drawn SVG icon tiles; toolbar as a white rounded card; navy primary buttons; teal-tinted active states. Brand navy `#0A3A63` and teal `#00A9A5` kept; one type family (Plus Jakarta Sans). Only features that exist in the app were taken from the references (no doctors, AI, emergency or other Cliniva modules). Mobile: 44px tap targets, 3-up compact KPIs, safe-area padding, split-pane handle visible, reduced-motion respected. Markup edits were minimal: the `<link>` to `css/theme.css`, `theme-color #ffffff`, and an inline SVG icon in each of the two sidebar buttons. Checked in rendered screenshots at 1280px and 390px (no horizontal overflow). **Appointment cards (Phase 3b):** `css/theme.css` ends with an "Appointment cards" section that overrides the row/grid rules in `css/style.css` (lines ~149-175, 416-421): `.appt-card` is `display:flex; flex-direction:column; align-items:stretch`, `.appt-list` has a `gap` and no shared border, details are an auto-fit grid (min 180px) with `overflow-wrap:anywhere`. If the old grid rules in `style.css` are ever deleted, the theme section keeps working on its own.
**Phase 4 (10 Nov 2026):** the Reports block is appended to the end of `css/theme.css` (`.rep-*` classes). It reuses the Phase 3 tokens, the tinted KPI cards (own icons: receipt / check / alert), the card style and the standard `.pagination`; on phones the table becomes stacked cards (CSS grid areas, labels from `data-label`). Procedure matches use a teal highlight (`.rep-hit`); `Partly paid` uses an amber dot (`.paid-badge.partial`).

*Not yet restyled (follow-up candidates):* the patient **edit** pane, the acts manager, invoice modal, print and email invoice layouts (left as they were), dark mode, charts/sparklines, a dashboard summary page, replacing `confirm()`/`prompt()` with dialogs.

*Original `style.css` notes (still true underneath the theme):*

- Design tokens in `:root`: `--blue #0A3A63`, `--blue-mid #0d5295`, `--teal #00A9A5`, `--teal-light`, `--teal-dim`, `--bg #EEF3F8`, `--surface #F8FAFC`, `--border #DDE8F0`, `--text #0E1E2E`, `--muted #7A8FA3`, `--red`, `--green` (+ light variants), shadows, radii (12 / 8 / 18px).
- Current look: navy top bar, teal primary buttons, pill-shaped CTAs (`border-radius:100px`), rounded cards (18px) with soft shadows, gradient login background, 1.5px bordered inputs with teal focus glow, uppercase micro-labels with wide letter-spacing, small tinted pill badges, hover `translateY(-1px)` lifts, modal backdrop blur + spring scale-in. **These are the "AI-looking" tells to rework.**
- Layout: patients page = 320px list + fluid detail pane (max 800px); appointments = centered 900px column.
- Responsive breakpoint 860px (drawer nav, stacked split pane with drag handle); 640px for invoice grids; inputs forced to 16px on mobile to stop iOS zoom.
- Print stylesheet (`@media print`) hides the app and styles `.print-*` classes; screen/print/email invoices are three **separate** implementations of the same layout.
- Some CSS is duplicated/dead (`*{margin:0…}` reset appears twice, `--light` var unused, `.form-row-3` unused).

---

---

## 8. Systems outside the repo

### 8.1 Google Apps Script (bound to the Google Sheet / intake Form)
- `onFormSubmit(e)`: (1) uppercases every string in the new row, (2) makes sure column B is `REFERENCE NUMBER` (inserts the column if missing), (3) calls `GET /api/patients?action=next-ref-public&sync_token=…` for a reference and writes it to column B, (4) calls `syncPatientToSupabase` → `POST /api/sync-patient`.
- Column map (1-based): 2 REFERENCE, 3 NAME, 4 GENDER, 5 AGE_CATEGORY, 6 PHONE, 7 WHATSAPP, 8 BIRTHDATE, 9 EMAIL, 10 CITY, 11 COMPANY, 12 PROFESSION, 13–15 EMERGENCY name/relation/phone. Column A is the form timestamp. Matches the `A:O` layout the API writes.
- `mapGender`: MALE→0, FEMALE→1. `mapAgeCategory`: contains CHILD/TEEN/ADULT/SENIOR → 0/1/2/3.
- Birthdate: `new Date(value)` then `toISOString().split("T")[0]` (timezone- and format-sensitive, see F6).
- `previewReconciliation()` (dry run, shows popup), `runReconciliation()` (real run), `onOpen()` adds a "🦷 Rivers Dental" menu to the sheet. A 3 AM time trigger is meant to run `runReconciliation` as a backup to the GitHub 2 AM job.
- Config consts: `DASHBOARD_URL = https://rivershub.vercel.app`, `SYNC_TOKEN` (token A).
- Header comment still says "Render server"; harmless, the URL is already Vercel.

### 8.2 Supabase objects
**Known (DDL provided):**
- `patients`: id uuid PK, `reference_number text unique not null`, name, gender int, age_category int, phone, whatsapp, `birthdate date`, email, city, company, profession, emergency_contact_name/relation/phone, allergies, notes, `created_at timestamptz default now()`. Index on reference_number.
- `invoices`: id uuid PK, `reference_number → patients(reference_number) ON DELETE CASCADE`, invoice_number, date, discount_pct, discount_amount, subtotal, grand_total, amount_paid, amount_remaining, paid, created_at.
- `invoice_items`: id, `invoice_id → invoices(id) ON DELETE CASCADE`, **procedure text** (name, not an FK), qty, unit_price, total_price, patient_share, created_at.
- `get_next_reference()` *(Phase 1, SQL 1a; **confirmed run 10 Nov 2026**, `reference_counters` returns rows)*: now `INSERT … ON CONFLICT DO UPDATE … RETURNING` on `reference_counters(year_prefix, last_value)`, seeded from the current max per year; first ref of a year is still **2044**, so refs look like `RDC/26/2044` and **restart at 2044 every year**. Atomic. (Before: `MAX()+1`, plain read, no lock.)
- ~~Trigger `on_patient_deleted`~~ **to be dropped in Phase 1 (SQL 1b; run status to be confirmed, §13)**. As it was: (AFTER DELETE, **FOR EACH ROW**) → `notify_patient_deleted()` → `net.http_post('https://riversdashboard.onrender.com/api/sync-reconcile', body with sync_token "google_app_script_supabase" (token B), dry_run:false)`.
- Note: the invoice schema script begins with `DROP TABLE invoices CASCADE`; it is a historical migration, **never re-run it**.

**Not yet seen (DDL needed):** `invoice_history`, `medical_acts`. Unknown whether `invoice_history.invoice_id` cascades on invoice/patient delete.

### 8.3 Updated data flow
```
Intake Form → Sheet row (Apps Script uppercases it, fetches ref from /api/patients)
            → /api/sync-patient → Supabase (upsert)
Dashboard patient CRUD → /api/patients → Supabase → (async) Sheet "Patient_data"
Patient DELETE → Supabase → dashboard deleteFromSheets via waitUntil (fixed, Phase 1)
                         → nightly reconcile: GitHub 02:00 UTC + Apps Script 03:00 (safety net)
                         (old DB trigger → Render reconcile removed in Phase 1, SQL 1b)
Calendar ⇄ /api/appointments, /api/manage;  Calendar(tomorrow) → cron → /api/sms → mNotify
Invoices → /api/invoices → Supabase; email via Gmail API
```

---

## 9. Agreed decisions

| # | Topic | Decision | Status |
|---|---|---|---|
| D1 | Auth | One shared staff password for now. Per-user accounts later. All auth stays routed through `authRequest()` so the later switch happens in one place. | Agreed |
| D2 | Appointments | Stay plain-text Google Calendar events. No linking to patient records. Anything needing patient data (SMS etc.) reads the `patients` table, never the calendar. | Agreed |
| D3 | Invoices | Data model unchanged. New **Reports** page = read-only index/log of every invoice (no new records, no new table). | **Implemented (Phase 4)** |
| D4 | SMS | Keep the two appointment reminders (13:00 and 18:00 UTC). Add: birthday, holiday, and review-recall messages. Patients with no phone are skipped. Per-message-type opt-out flags on the patient. | Agreed |
| D5 | Review recall | Due date = invoice date + a **fixed interval per procedure** (e.g. Scaling & Polishing = 6 months). | Agreed |
| D6 | Frontend | Split `index.html` into plain classic script files (not ES modules; no framework, no build step; Vite rejected by the user) **before** the UI redesign. | **Implemented (Phase 2)** |
| D7 | Sheets deletion | Fix `deleteFromSheets` (remove the stray `if (!tab)`), run Sheets writes through Vercel `waitUntil` (`@vercel/functions`) so responses stay fast and the work still finishes, drop the DB trigger `on_patient_deleted` and `notify_patient_deleted()`. Nightly reconcile stays. Accepted trade-off: a delete made directly inside Supabase waits for the 2 AM reconcile. | **Implemented (Phase 1)** |
| D8 | Reference numbers | Atomic counter in the database (same `RDC/YY/NNNN` format, 2044 yearly start). Dashboard assigns the ref **at save** (field shows "assigned on save"). `POST /api/patients` becomes a real insert that returns 409 on a duplicate. `/api/sync-patient` keeps its upsert. A wait timer was considered and rejected (separate serverless instances; collision window is minutes). | **Implemented (Phase 1)** |
| D9 | SMS names | Title-case the **full name** in every SMS, including the existing appointment reminders, via one shared `titleCase()` helper (hyphens and apostrophes handled). No first-name guessing. | Agreed |
| D10 | Leftover deps | Drop `express`, `compression`, `nodemailer`, `express-rate-limit` and the `start`/`dev` scripts from `api/package.json`. | **Implemented (Phase 1)** |
| D11 | Reports | One cross-patient log of every invoice, filterable by procedure (to find specific work quickly), plus date range, status, patient. Read-only index; separate from the per-invoice `invoice_history` audit table. | **Implemented (Phase 4)** |
| D12 | Recall data | Build the recall logic now, fill the data later. `recall_months` stays null (= no recall, nothing sent) until the user supplies intervals per procedure; the acts manager gets a "Recall (months)" field so it can be filled in without SQL. | Agreed |
| D13 | Reports details | (a) No invoice-number column: it equals the patient reference for every invoice, so rows show date, patient name + reference. (b) Status adds **Partly paid** (paid > 0 and remaining > 0). (c) Billed / collected / outstanding are computed server-side over the whole filtered set and shown as KPI cards at the top (not a footer, not page-only). (d) Default period = current month; presets this / last month, this year, all time. (e) Procedure filter = datalist from the acts list + free text; matching lines highlighted with a per-procedure subtotal. (f) CSV export of every match; no print view (would be a 4th invoice-style layout). (g) Clicking a row opens that patient. (h) Credentials only in the `Authorization` header. | **Implemented (Phase 4)** |

---

## 10. Findings and agreed fixes

| ID | Severity | Finding | Proposed fix |
|---|---|---|---|
| **F1** | High | Reference numbers can collide. `get_next_reference` is `MAX()+1` with no reservation. A ref is handed out when the dashboard "New patient" pane opens (saved later) and when the Apps Script runs. `POST /api/patients` and `/api/sync-patient` both **upsert on `reference_number`**, so a collision silently **overwrites an existing patient**. Deleting the highest-numbered patient also lets its number be reused. | **Agreed (D8).** Atomic counter (counter table with `INSERT … ON CONFLICT DO UPDATE … RETURNING`, seeded from the current max per year, same format and 2044 start). Dashboard assigns the ref **at save**. `POST /api/patients` becomes a true insert that returns 409 on duplicates. `/api/sync-patient` keeps its upsert (Apps Script re-sends are idempotent, and with the counter it cannot collide). A wait timer was rejected: each request can run on its own instance, and the collision window is minutes, not milliseconds. |
| **F2** | Medium | Three mechanisms remove Sheet rows: dashboard `deleteFromSheets` (broken: `if (!tab)` before `const tab`), DB trigger → reconcile, nightly reconcile. Only the nightly one works today. If the first two were both fixed they could **race**, because both delete by row index and a stale index can remove the wrong row. | **Agreed (D7).** One immediate mechanism only: fixed `deleteFromSheets`, with Sheets writes run via `waitUntil` (not a plain `await`, which would slow every save). Drop the DB trigger. Nightly reconcile stays. `waitUntil` is bound by the 30 s function limit; verify it loads from CommonJS handlers, else fall back to `await`. |
| **F3** | Medium | Trigger points at the old Render URL, uses token B (differs from the Apps Script's token A, so at most one can match the Vercel `SYNC_TOKEN`), and fires once per deleted row (N deletes = N full reconciles). | Covered by the F2 decision. |
| **F4** | Medium | Token values live in the Apps Script, the DB function, GitHub secrets, Vercel env, and now a chat transcript. | Rotate `SYNC_TOKEN` during cleanup and update all four places. |
| **F5** | Medium | DDL for `invoice_history` and `medical_acts` not seen. Needed for Reports and for the recall-interval column. | Get DDL (see §13). |
| **F6** | Medium | Birthday SMS depends on clean `birthdate` values. The Apps Script conversion depends on the script's timezone and on how the form returns dates (day/month swaps are possible). All text is also stored UPPERCASE (Apps Script + dashboard both uppercase). | **Resolved by user:** birthdate format is fine and timezone is UTC+0 (also glance at the spreadsheet's own File → Settings timezone). SMS uses the **full name, title-cased** (D9). |
| **F7** | Low | Vercel code assumes the tab is named `Patient_data`; the Apps Script uses whichever sheet receives form responses. Assumed to be the same tab. | Confirm. |
| **F8** | Low | During `onFormSubmit` the row exists in Sheets before Supabase has it. A reconcile run in that window would delete it from Sheets. | Narrow; mostly removed if the F2 trigger is dropped. |
| **F9** | Low | `api/package.json` lists `express`, `compression`, `nodemailer`, `express-rate-limit` and `start: node server.js`. Grep of `api/*.js` and `index.html` confirms none are used. Nothing in the Apps Script or SQL uses them (not Node). | **Agreed (D10).** Trim to `@supabase/supabase-js` + `googleapis` (+ `@vercel/functions`), same versions as the root file; remove the `start`/`dev` scripts. |
| **F10** | Info | Reference sequence restarts at 2044 each year (`COALESCE(…, 2043)`). | Preserve unless told otherwise. |
| **F11** | Low | `patients.js` CORS list still names Render. Harmless (same-origin calls). | One shared CORS helper used by every endpoint. |
| **F12** | **High** | **Found 9 Nov 2026.** `sync-reconcile.js` read Supabase with one unpaginated `select("*")`. Supabase's API silently returns at most **1000 rows**, so the reconcile only saw the first 1000 patients (by reference) and treated every other Sheet row as stale and **deleted it from the Sheet**. Result: Sheet stuck at 1000 rows vs 2,534 in Supabase, and newly added Form patients were removed from the Sheet nightly. Supabase data was never affected. | Paginate the read, verify against Supabase's row count, cap deletions per run, write new rows at an explicit row. Done. |
| **F13** | Low | **Found 10 Nov 2026.** `style.css` line 430, `.split-drag-handle{display:none}`, sits **after** the `@media(max-width:860px)` block that sets it to `display:flex` (line 420). Same specificity, later rule wins, so the drag handle is hidden on mobile and the split pane can't be resized. **Present since `515bd55`; not caused by the Phase 2 JS split** (the JS itself is fine). | Declare the `display:none` default *before* the media query and delete line 430. |
| **F14** | Low | **Found 10 Nov 2026.** In the uploaded working tree `js/main.js` was empty and its two auto-login lines had moved to the top of `js/auth.js`. That runs `attemptLogin()` while `nav`, `appointments`, `patients` and `invoice-*.js` are still loading; if the login request returned before they executed, `renderAll()` would throw. Unlikely (small static files vs a Calendar API call) but real on a slow first mobile load. | Put the lines back in `main.js` (last script) and delete them from `auth.js`. Patched files supplied 10 Nov 2026. |
| **F15** | Medium | **Found 10 Nov 2026.** The split-pane script set an inline `height` on `.patients-left` while dragging on a phone-width window and never cleared it. Resizing back to desktop kept that height, so the 3-column Patients layout broke (list squashed to a short block, rest of the column empty). Also the list could only be dragged to ~60-80% of the screen, and the drag used mouse/touch events separately. | Pointer Events; 85% max, 220px min; clear the inline height when the layout leaves mobile; CSS `!important` guard at >=861px. **Fix supplied (Phase 3c); verified in Playwright (390px drag, then 1280px).** |

**Phase 1 status (9 Nov 2026):** code verified by reading the updated repo and running a mock-database test harness (29/29 checks pass).

| ID | Status |
|---|---|
| F1 | **Done, verified live 10 Nov 2026**: new patient saved, ref matches the counter, Sheet row appears; SQL 1a confirmed run. |
| F2 / F3 | Code done; **live delete test passed 10 Nov 2026** (Sheet row removed within seconds). **SQL 1b (drop trigger/function) still to confirm.** |
| F4 | **Deferred by owner (10 Nov 2026):** `SYNC_TOKEN` not rotated; accepted risk (the value was pasted into a chat once). Revisit if it is ever shared again. |
| F9 | **Done**: `api/package.json` trimmed; root `package.json` now includes `@vercel/functions` (verified in the 10 Nov zip). |
| F11 | Done. `api/_cors.js` used by all 8 handlers; no Render URLs remain. |
| F7 | **Resolved 10 Nov 2026:** the tab is `Patient_data`. |
| F5, F8, F10 | Unchanged (F10 preserved: still starts at 2044 each year). |
| F12 | **Fixed and verified in production (9 Nov 2026).** GitHub Actions nightly reconcile reported `total_in_supabase: 2535`, `total_in_sheets: 2535`, `only_in_*: []`, `action: already_in_sync`. Counts above 1000 prove pagination works. |
| F13 | **Applied in the working tree** (rule moved above the media query, `touch-action:none` added; confirmed in the 10 Nov zip, uncommitted). **Still to verify on a phone.** Also forced in `css/theme.css`, so it holds even if `style.css` changes. |
| F14 | Patched `auth.js` / `main.js` supplied 10 Nov 2026. **To apply.** |
| F15 | **Fixed 10 Nov 2026**: supplied `js/nav.js` (Pointer Events, 85% max / 220px min, inline height cleared when leaving the phone layout) + the `theme.css` guard. Verified in headless Chrome: 390px drag reaches 85%; widening to 1280px gives a 340px list at full height with no inline height. **Still to confirm on a real phone.** |

---

## 11. Design notes for planned features

### 11.1 Reports (read-only invoice log): **implemented in Phase 4 (see D13 and §5 `/api/reports`)**; original spec kept below
- New nav item **Reports**. One row per invoice: date, invoice no., patient name, procedures, total, paid, remaining, status.
- Query: `invoices` with `patients(name)` and `invoice_items(*)` embedded (works because `invoices.reference_number` is a FK to `patients`).
- Filters: **procedure** (dropdown from the acts list plus free-text match on `invoice_items.procedure`), date range, status (paid / unpaid), patient search. When a procedure filter is active, highlight the matching line items and show that procedure's subtotal. Footer totals: billed, collected, outstanding. Optional CSV export and print view.
- Server-side pagination (the table will grow). New endpoint `GET /api/reports`. No schema change.

### 11.2 SMS expansion
Unchanged: appointment reminders (13:00 + 18:00 UTC cron).

New (proposed SQL, **not yet run**):
```sql
alter table patients
  add column optout_birthday boolean not null default false,
  add column optout_holiday  boolean not null default false,
  add column optout_review   boolean not null default false;

alter table medical_acts add column recall_months integer;   -- null = no recall (confirm after DDL check)

create table holidays (
  id uuid default gen_random_uuid() primary key,
  name text not null, date date not null,
  message text not null, active boolean default true
);                                   -- staff-maintained: Easter/Eid dates move yearly

create table sms_log (
  id uuid default gen_random_uuid() primary key,
  reference_number text references patients(reference_number) on delete cascade,
  type text not null,                -- birthday | holiday | review | reminder
  dedupe_key text not null,          -- e.g. '2026', 'christmas-2026', 'invoice:<id>'
  phone text, message text, status text, provider_response text,
  sent_at timestamptz default now(),
  unique (reference_number, type, dedupe_key)
);
```
Rules:
- Skip patients with no phone. Skip a message type if that patient's opt-out flag is true. The unique key in `sms_log` stops double sends.
- **Birthday:** match month/day of `patients.birthdate` to today. Handle 29 Feb (send 28 Feb in non-leap years).
- **Holiday:** same message to many patients. Use mNotify's multi-recipient send and batch it. The current 300 ms-per-SMS loop inside a 30 s function caps at about 90 messages.
- **Review recall:** for each patient, take the **latest** invoice item per recall procedure; due date = invoice date + `recall_months`. A newer invoice for the same procedure resets the clock. **Ships dormant:** `recall_months` is null for every act until the user fills in intervals (editable in the acts manager); null means no recall. **No backlog blast:** a reminder is sent only when the due date falls within the next 7 days (never for already-past due dates) and once per invoice (`sms_log` dedupe), so switching an interval on does not message every historic patient. Matching is by procedure **name** (`invoice_items.procedure` is text). Renaming an act in the manager breaks matching for old invoices; optional fix: add `invoice_items.act_id` and backfill by name.
- **Wording:** plain text only (emoji or special characters drop a segment from 160 to 70 characters). Names are stored in capitals, so every SMS passes the **full name** through a shared `titleCase()` helper (D9).
- **Scheduling:** a new GitHub Actions workflow (separate from `reminders.yml`) calling a new endpoint. Defaults unless changed: birthdays and holidays at 08:00 UTC on the day; review reminders 7 days before due.
- Opt-outs are staff-managed (one-way sender ID, so "reply STOP" is not possible). A checkbox set on the patient form.
- Reminder SMS stay un-opted-out; could also be logged to `sms_log`.

### 11.3 Frontend split (target layout)
```
index.html                markup shell only
css/   tokens.css, layout.css, components.css, print.css
js/    main.js            boot, page switching
       api.js             fetch + auth (single place for the Bearer header)
       ui.js              toast, modals, escaping, confirm dialogs
       invoice-render.js  ONE invoice layout reused for modal, print, and email
       pages/appointments.js, patients.js, invoices.js, acts.js, reports.js, sms.js
```
Inline `onclick="…"` replaced by `data-action` attributes handled in one delegated listener.
*Phase 2 delivered the simpler `js/` layout shown in §2 (a pure move, no behaviour change). The target above (css/ split, one `api.js`, a single invoice renderer, `data-action` delegation) remains the direction for later phases.*

### 11.4 Cleanup list
*Phase 1 (9 Nov 2026): code items below are done; the two SQL items and the token rotation need user confirmation (§13).*

- Trim `api/package.json` and add `@vercel/functions` (F9) · shared CORS helper (F11) · fix `deleteFromSheets` and run Sheets writes via `waitUntil` (F2) · drop DB trigger and `notify_patient_deleted()` (F2/F3) · rotate `SYNC_TOKEN` (F4) · atomic reference counter + insert-not-upsert on `POST /api/patients` + "assigned on save" UI (F1).

---

## 12. Roadmap

| Phase | Work | Status |
|---|---|---|
| 0 | Discuss and agree scope | **Done** |
| 1 | Backend/DB hardening: F1, F2/F3, F4, F9, F11 (+ F12 found and fixed) | **Done.** Live tests passed 10 Nov 2026 (new patient, edit, delete, intake form, reconcile). Open: confirm SQL 1b; F4 token rotation deferred by owner |
| 2 | Split frontend into modules (no visual change) | **Done (10 Nov 2026).** 12 plain script files in `js/`; user tested every area, all working. Only the mobile split-pane handle was off, caused by pre-existing CSS bug F13 (fix applied). Re-verified against the repo zip 10 Nov: all 1,148 original script lines present, no duplicate declarations, combined load order parses; F14 follow-up supplied |
| 3 | UI redesign (less AI-looking) on the new structure | **Core done (10 Nov 2026).** `css/theme.css` (sidebar/top bar, KPI cards, toolbar, drawer, mobile pass), 3b appointment cards, 3c drawer icons + patient detail pane. **Phase 3 close-out folded into the Phase 4 delivery:** `nav.js` split-pane rewrite (F15) and the six `patients.js` edits. Still on the old look (deferred, none block later phases): patient edit pane, invoice modal, print and email layouts, acts manager, `confirm()`/`prompt()` dialogs. |
| 4 | Reports page + `/api/reports` | **Code done and tested (10 Nov 2026)**: backend 16/16 mock-DB checks; front end verified in headless Chrome (desktop + 390px). **Pending: owner copies the files, deploys and runs the live checklist (§13).** |
| 5 | SMS expansion (schema, endpoint, workflow, patient opt-out checkboxes, acts recall column) | Not started |

---

## 13. Open items

**Waiting on the user: Phase 3 close-out + Phase 4 (files supplied 10 Nov 2026)**
- **Copy into the repo** (same paths, replace): `index.html`, `js/nav.js`, `js/patients.js`, `css/theme.css`; **new files** `js/reports.js` and `api/reports.js`. Then commit and push everything (the zip also carried uncommitted line-ending noise; optional `.gitattributes`: `* text=auto eol=lf`). No SQL, no env vars, no new dependencies.
- **Live checklist (after the deploy):**
  1. *Reports opens:* sidebar/drawer shows **Reports**; it defaults to this month and shows KPI cards + rows.
  2. *Totals are right:* in Supabase run `select sum(grand_total), sum(amount_paid), sum(amount_remaining), count(*) from invoices where date between 'YYYY-MM-01' and 'YYYY-MM-31';` and compare with the three cards and the invoice count (use the same dates).
  3. *Procedure filter:* pick e.g. SCALING AND POLISHING; matching lines are highlighted and the teal summary shows lines / qty / subtotal; try a partial word too.
  4. *Status:* Paid, Partly paid and Unpaid each change the list; "Partly paid" should match invoices with some money paid and a balance.
  5. *Patient search:* a name fragment and a reference prefix (e.g. `RDC/26/25`).
  6. *Pagination:* page 2 loads without the KPI cards changing; Reset returns to this month.
  7. *Export CSV:* opens in Excel with correct columns and **all** matching invoices (not just 25).
  8. *Click a row:* opens that patient's page (on a phone too).
  9. *Phone width:* rows are stacked cards, no sideways scrolling, filters usable with the keyboard up.
  10. *Phase 3c bits:* patient page shows the "gender · age · phone" line, phone and email are tappable, Delete is soft red; on a phone drag the list handle to ~85%, then rotate or widen to desktop: 3 columns intact.
- Confirm **SQL 1b** ran (both queries should return 0 rows): `select tgname from pg_trigger where tgname='on_patient_deleted';` and `select proname from pg_proc where proname='notify_patient_deleted';`
- Optional tidy-ups: make root and `api/` `engines.node` agree (Node 26 is Vercel's default since 29 Oct 2026; after deploys on 26, smoke-test Sheets writes, SMS and invoice email); remove the unused Libre Baskerville font import from `index.html`.
- **Closed 10 Nov 2026:** SQL 1a, live tests, the two Phase 1 code fixes, `Patient_data` tab name, nightly reconcile green, `DEP0169 url.parse()` log line (dependency notice), F13/F14 (confirmed in the zip), Phase 3/3b markup + CSS (confirmed in the zip).
- **Deferred by owner:** `SYNC_TOKEN` rotation (F4).

**Waiting on the user (earlier)**
- (Optional, no longer blocking) Output of these two queries (F5). Migrations will be written defensively with `if not exists`; the output is only needed to confirm the `invoice_history` cascade behaviour:
  ```sql
  select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema='public' and table_name in ('invoice_history','medical_acts')
  order by table_name, ordinal_position;

  select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid)
  from pg_constraint
  where conrelid in ('public.invoice_history'::regclass,'public.medical_acts'::regclass);
  ```

**To check (no reply needed unless something differs)**
- Is the Render service still running? If not, the delete trigger has been failing silently since the migration.
- ~~Form-response tab name~~ confirmed `Patient_data` (10 Nov 2026); timezone confirmed UTC+0.
- Which of token A / token B equals Vercel's `SYNC_TOKEN`? (Likely token A, since the intake form passes; token B died with the trigger.)

**Needed now**
- Results of the live checklist above. Decide whether the remaining restyle items (edit pane, invoice modal, print/email layouts, acts manager, dialogs instead of `confirm()`/`prompt()`) happen before or after Phase 5.

**Needed later (Phase 5)**
- Which holidays to message and the wording; procedures with recall intervals (user will supply, e.g. Scaling & Polishing = 6; can be entered later in the acts manager); confirm the default send times and the 7-day lead for review reminders.

---

## 14. Changelog
- 10 Nov 2026 (latest, Phase 4 + Phase 3 close-out): **Reports page built.** Cross-checked the 6fa675a zip against this file first: F13/F14, Phase 3/3b markup and CSS were present; **not** applied were the `nav.js` split-pane rewrite (F15) and the six `patients.js` edits; the file map had drifted (`css/style.css` is 456 lines, theme.css was ~199). Delivered: `api/reports.js` (owner-supplied draft, kept; added `"` to the stripped filter characters), `js/reports.js`, Reports nav item (sidebar + drawer), `#page-reports` markup and a Reports block in `css/theme.css`; plus the Phase 3c close-out: Pointer-Events split pane (F15) and the patients edits (facts line, `btn-danger`, `tel:`/`mailto:` links, detail fetch now sends credentials in the header). Decisions in D13. Checks: mock-DB harness for the endpoint (auth, 405, filters, totals, procedure subtotal, CSV escaping, limit clamp: 16/16); headless Chrome with a stubbed API: 25 rows render, KPI totals, no horizontal overflow at 390px, procedure highlight + subtotal, row click opens the patient, tap links present, drag to 85% then widen to desktop clears the inline height, 220px minimum holds. Context file updated (§2, §5, §6, §7, §9 D3/D11/D13, §10 F15, §11.1, §12, §13, §15).
- 10 Nov 2026 (Phase 3c): **Drawer, split pane and patient detail.** (1) Drawer links had SVG icons without a size rule, so they filled the screen on phones; added `.drawer-link svg{width:20px;height:20px}` and flex alignment. (2) Split-pane rewritten with Pointer Events: list can grow to 85% of the split area (was capped near 60-80%), min 220px; fixed **F15** (dragged inline height survived the switch back to desktop and broke the 3-column layout). (3) **Patient detail pane redesigned**: white header card (name, teal reference chip, quick facts line `gender · age category · phone`, actions), section cards with small uppercase labels, phone/email now tap-to-call/mail links, Delete as a soft-red `btn-danger`, invoice table sits directly in its card (no nested card), phone layout stacks with a full-width `+ Invoice` and 2-up grid. Removed the leftover teal underline (`inset box-shadow` from `style.css`) on the active sidebar link. Verified in Playwright on a local server with stubbed API: drawer icons 20x20; drag down = 85% (614 of 722px); back to 1280px = list 340px wide and full height, no inline height; no horizontal overflow at 390px.
- 10 Nov 2026 (Phase 3b): **Appointment cards redesigned.** Each appointment is now its own card with a gap between cards (before: divided rows inside one shared box). Fixed overflow (fixed 7.5rem time column with `nowrap`, no wrapping rules for long emails/titles/notes) and the leftover `align-items:start` from the old grid that made dividers and buttons shrink-wrap. Time now shows the **start time only** (no end time). Removed the pencil emoji; `Remind` is a soft teal button and `Edit notes` an outlined button (equal width on phones). Removed the calendar emoji from the Today group header. JS touched in `js/appointments.js` only (4 one-line edits: group label, `tr`, `.appt-top` markup order, edit button label); CSS in a new section at the end of `css/theme.css` (7 older `.appt-*` lines there were removed). Tested on a scratch copy with a long title/email/notes at 1280px and 390px: no overflow, gaps of ~13px/11px.
- 10 Nov 2026 (Phase 3, core): **UI redesign core delivered** as `css/theme.css` (override layer, 120 lines, ~8 KB) plus minimal `index.html` edits (stylesheet link, theme-color, two SVG nav icons). Look: white sidebar (desktop) / white top bar with drawer (<=860px), lavender page, tinted KPI cards with icon tiles, soft-depth cards, navy buttons, teal active states. Built on a scratch copy of the repo, rendered with Playwright at 1280px and 390px (appointments, patients, open drawer); no horizontal overflow. No JS changes. Remaining restyle items are listed in section 7.
- 10 Nov 2026 (earlier): **Contexts merged, repo re-reviewed, Phase 3 started.** Merged the Phase 0–1 context with the Phase 2 session file (this file). Checked the uploaded repo: split is lossless (1,148/1,148 script lines), all 12 files parse together, F13 and both Phase 1 code fixes are present. Found **F14** (`main.js` empty, auto-login in `auth.js`); patched files supplied. Closed: SQL 1a, live tests, `Patient_data`, DEP0169 notice. Deferred: F4. Correction: an early read of the 9 Nov reconcile output ("1000 vs 1001 rows, healthy") missed that 1000 is Supabase's row cap; that run was the F12 bug at work, since fixed.
- 10 Nov 2026: **Phase 2 done: frontend split into 12 plain script files** (`js/config, utils, acts, auth, nav, appointments, patients, invoice-list, invoice-form, invoice-print, invoice-email, main`). Method: first moved the whole inline script to `js/app.js` (Step 0), then cut blocks out bottom-up; auto-login lines moved to `main.js` loaded last. A scripted replay of all 16 steps loaded cleanly after every step and kept all 1,148 code lines. User confirmed every area works. Found **F13** (mobile split-pane handle hidden by a CSS rule-order bug that predates the split); fix supplied. Ready for Phase 3.
- 9 Nov 2026 (later): **F12 found and fixed.** Nightly reconcile was reading only 1000 of 2,534 patients (Supabase default row cap) and deleting the rest from the Sheet. `sync-reconcile.js` now paginates, checks the row count, limits deletions per run (25, override with `force=true`) and writes new rows at an explicit row. Mock-DB tests (in-sync, wiped Sheet, short read, delete guard, delete+add position) all passed. Live GitHub Actions run afterwards: Supabase 2535 / Sheets 2535, `already_in_sync`. Ready for Phase 2.
- 9 Nov 2026 (earlier): **Phase 1 applied and reviewed.** Added `api/_cors.js` (F11); `patients.js`: TDZ fix in `deleteFromSheets`, `waitUntil` via `background()`, POST is now insert + 409 + retry (F1/F2/D7/D8); `index.html`: "Assigned on save" and open-patient-after-create; `api/package.json` trimmed (F9/D10). Mock-DB harness: 29/29 pass. Open: confirm SQL 1a/1b, rotate `SYNC_TOKEN` (F4), two small fixes (§13).
- 6 Nov 2026: Added D11 (Reports spec with procedure filter) and D12 (recall ships dormant, no backlog blast). DDL query downgraded to optional.
- 6 Nov 2026 (later): Scope agreed, decisions D7–D10 recorded; F1, F2/F3, F6, F9 marked agreed/resolved. Still waiting on the `invoice_history` / `medical_acts` DDL.
- 6 Nov 2026: Log created. Added Apps Script and Supabase SQL review (F1–F11). Patched v1 context file. Recorded decisions D1–D7.
- 6 Nov 2026 (merge): `RIVERSHUB_PROJECT_LOG.md` merged into this file and retired; this is now the single source of truth. §1–7 = code today, §8–14 = outside systems, decisions, plan.

---

## 15. Additional observations (not yet scheduled)

_Items already covered by findings F1–F11 in §10 are tracked there; the rest below are unscheduled notes._

**Bugs**
1. ~~**Fixed in Phase 1.**~~ `patients.js › deleteFromSheets`: `if (!tab)` runs **before** `const tab` is declared → ReferenceError (TDZ), caught and logged. Sheet rows are never deleted at delete-time. Part of a bigger picture (DB trigger + nightly reconcile), see §10 F2/F3.
2. ~~**Fixed in Phase 1** (shared `_cors.js`).~~ `patients.js` CORS allow-list still points at Render URLs (`riversdashboard.onrender.com`), not Vercel.
3. ~~**Fixed in Phase 1** (trimmed).~~ `api/package.json` is probably the *active* manifest for the functions (a commit bumped supabase-js there) but still lists unused Express-era deps (`express`, `compression`, `nodemailer`, `express-rate-limit`) and a `start: node server.js` script. See §10 F9.
4. Appointment list only returns events from "now", so earlier appointments today disappear from "Today" count mid-day.
5. `authRequest` splits the Bearer value on `:` — a password containing `:` will fail.
6. `viewPatient` now sends credentials in the header (Phase 4 delivery). `invEmail` still sends them in the query string; the login check does too (by design, before a password is stored).
7. `markInvoiceFullyPaid` / `editInvoice` rely on re-fetching all invoices for the patient and `allPatients` for the name (name lookup fails if the patient isn't on the current list page).
8. Cron SMS "tomorrow" is computed in UTC; fine for Ghana, fragile otherwise. Cron sends to **every** event with a phone, including duplicates / cancelled-but-not-deleted ones, and runs twice daily (patients may get two SMS).
9. `PUT /api/invoices` and `DELETE /api/manage` are unused by the UI.

**Phase 2 observations (for Phase 3 and later)**
- Shared state is still global (`currentPassword`, `viewingPatient`, `editingPatient`, `allPatients`, `allAppointments`, `ACT_PRICES`, `ACTS`). Tidying it is a later job.
- Inline `onclick=` handlers (26) still tie the markup to global function names; any renamed or moved function must stay global until they are replaced by `data-action` delegation.
- `style.css` was not split in Phase 2; the redesign (Phase 3) should restructure it and can fix other cascade-order problems like F13 on the way.
- The invoice layout still exists three times (modal, print, email); a single renderer is still the planned cleanup.
- Bugs 6 and 7 above still stand after the split (the split moved code, it did not change it): `viewPatient`/`invEmail` still send credentials in the query string; `editInvoice` still looks the name up in `allPatients`.
- `style.css` is still one file; the `css/` split in §11.3 is part of Phase 3. Phase 3 took the lower-risk route: an override file (`css/theme.css`) instead of restructuring `style.css`; folding the theme into a proper css/ split can happen later.

**New observations from Phase 1 review (not scheduled)**
- **Lesson from F12:** any Supabase `select` that must read a whole table needs `.range()` pagination (default cap 1000 rows, silent). Other full-table reads in the repo (`patients` list, invoices per patient, acts) were checked: the patient list already uses `.range()`, the others are small or filtered. Apply this to any new endpoint (Reports, SMS) in later phases.
- The Apps Script's own 3 AM `runReconciliation` is believed to call `/api/sync-reconcile`; if it has its own comparison logic it needs the same pagination check (script not in repo).
- Original Google Form timestamps (column A) of any rows that were wiped before F12 was fixed are replaced by Supabase `created_at` values when re-added; the pre-fix Sheet copy/version history is the only source of the originals.
- The server accepts a patient with no name (`validatePatient` does not require it; only the form label says "Full Name *").
- A reference number is consumed when an auto-assigned POST later fails validation, so gaps in the sequence are possible (harmless).
- The authenticated `GET /api/patients?action=next-ref` is no longer used by the dashboard (the Apps Script uses `next-ref-public`). Candidate for removal.
- Mixed Windows/Unix line endings may appear in diffs (`_cors.js` was written with CRLF in the original paste); consider a `.gitattributes`.

**Security / architecture**
- Single shared password stored in `localStorage`; token hardcoded in client JS; no rate limiting on login; no roles or audit trail (invoice history has no "who").
- Invoice math is client-trusted; server doesn't validate totals.
- Invoice email HTML is built client-side and sent as-is (anyone with the password can send arbitrary HTML from the clinic's Gmail).
- No tests, no linting, no build step; the whole frontend is one 1.5k-line file with global state, inline handlers and string-template rendering, which makes the UI overhaul harder than it needs to be.
- Patient `allergies`/`notes` are not in Sheets; `sync-patient` bypasses validation.

**UX observations**
- No appointment ↔ patient link (appointments are free-text Calendar events; no way to jump from an appointment to a patient or create an invoice from it).
- No appointment delete/reschedule from the UI.
- Acts manager is buried in a patient's page.
- No dashboard overview beyond three counters; no payments/revenue view; no patient search from the appointments page.
- Heavy use of `confirm()`/`prompt()`.

---

**Phase 4 observations**
- Reports reads whole filtered sets for the KPI totals (chunks of 1000, stop at 20,000 invoices). At this clinic's volume that is fine; if the invoice count ever grows past that, move the sums into a Postgres function/RPC.
- `invoice_items.procedure` is plain text, so the procedure filter matches by name; renaming an act in the manager does not rewrite old invoices (same caveat as the recall design in §11.2).
- The invoice number column was left out on purpose (equals the patient reference). If invoice numbers ever become unique, add the column back in `repRenderRows` and the `<th>` row.
- No print view for Reports (would be a fourth invoice-style layout); CSV export covers "get it into Excel".

---

## 16. How to use this file

Reference me by area ("the invoice modal", "patients.js search", "login screen CSS") and I will edit the exact functions. Working agreements: shared staff password for now (per-user accounts later, via `authRequest`); appointments stay plain-text Calendar events; invoices keep their current model; Supabase is the source of truth and Sheets is a mirror; new work follows the roadmap in §12 and the decisions in §9.
