---
name: rivers-dental-clinic-dashboard
description: Full-stack dashboard for Rivers Dental Clinic in Accra, Ghana — appointment, patient, invoice, and SMS management (Phase 5)
mode: operate
surfaces:
  - appointments
  - patients
  - invoices
  - reports
  - sms
---

# Rivers Dental Clinic Staff Dashboard

## Product Overview

**Mode:** Operate

A web-based staff dashboard for Rivers Dental Clinic in Accra, Ghana, helping clinicians and office staff manage appointments, patients, and invoices efficiently.

**Hosting:** Vercel (`rivershub.vercel.app`)

**Primary Users:** Dental clinic staff (reception, nurses, clinicians)

**Current Phase:** Phase 5 (November 2026) — fully integrated SMS system (bi-daily reminders, birthday/holiday/review/followup SMS, SMS opt-out management, medical acts recall intervals, client-side invoice codes)

## Technical Stack

**Frontend:**
- Vanilla HTML/CSS/JS (no build step, no framework)
- Single-page app with shared global scope across 13 JS files
- Serverless CSS overrides (`theme.css` loaded after `style.css`)

**Backend:**
- Vercel serverless functions (`/api/*.js`)
- CommonJS modules (Node.js 26.x)
- Supabase PostgreSQL database (service-role key)

**Integrations:**
- Google Calendar (appointments)
- Google Sheets (patient sync mirror)
- Gmail API (invoice email)
- mNotify (SMS provider)

**Deployment:**
- Vercel configuration (`vercel.json`)
- GitHub Actions (nightly reconcile + bi-daily SMS reminders)

## Design Mode & Surface Strategy

**Mode:** Operate

The dashboard is tool-orientated: staff complete specific tasks (view appointments, edit patient details, create/adjust invoices, review reports, manage SMS preferences). The design prioritizes:

- **Scanability:** clear information hierarchy with KPI cards, appointment cards, patient lists, invoice tables
- **Consistency:** consistent patterns across medical acts, patients, invoices, SMS log
- **Native expectations:** familiar CRUD patterns, modal forms, split-panes for details on the right
- **Workflow completion:** actions close and return to previous state where possible, partial progress is recoverable

**Surfaces to design/optimize:**
- `appointments` — Upcoming/Today/This Week view, search/filter, new-appointment modal
- `patients` — Split-pane list + detail editor, manage medical acts, SMS opt-out
- `invoices` — Invoice list with payment status, history modal, print/email actions
- `reports` — Invoice activity log, filter by date/invoice, CSV export
- `sms` — SMS log, patient opt-out management, preferences (paginated 50/patient)

## Key Constraints

- **No build system** — changes to HTML, CSS, JS are live on deploy
- **Serverless function timeout:** 30s max
- **Supabase row limit:** 1000 rows/request (must paginate)
- **Shared global scope:** 13 JS files share one namespace (no ES modules)
- **Single staff password:** stored in `localStorage`; no per-user auth or audit trail
- **Invoice math is client-trusted:** server doesn't validate totals

## Design Tokens (Visual System)

**Colors:**
- Primary `#0A3A63` (dark navy — Trust, Professionalism)
- Background `#F5F7FA` (light grey — Clean, Easy on Eyes)
- Surface `#FFFFFF` (white cards — Contrast, Readability)
- Text `#1A1A1A` (near black — Highest Readability)
- Text-secondary `#666666` (grey — Labels, Metadata)
- Border `#E0E0E0` (light grey — Minimal Separation)
- Success `#28A745` (green — Paid/Fully Received)
- Warning `#FFC107` (amber — Partial Payment)
- Error `#DC3545` (red — Overdue/Erroneous)

**Typography:**
- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial`
- H1: 24px; H2: 20px; H3: 18px — clear hierarchy
- Body: 14px — optimal reading density
- Utility labels: 12px (uppercase, letter-spacing: 0.05em)

**Spacing:**
- Base: 8px grid
- Component spacing: 8px, 16px, 24px, 32px
- Card padding: 16px or 20px
- Form labels: bottom (12px) or left (16px)

**Components:**
- Cards: white background, border-radius 6px–8px, subtle shadow
- Buttons: primary (filled), secondary (outline), actions (small/icon)
- Inputs: 44px height (touch-friendly), 16px padding, 1px border
- Tables: border-bottom separation, sticky header on desktop, responsive row cards on mobile

**Responsive Breakpoints:**
- Mobile: max-width 768px — stacked cards, stacked tables, full-width inputs
- Desktop: min-width 769px — split-pane 20%/80%, side nav, table headers sticky

## Annual Planning Timeline (as of Nov 2026)

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1–6 | Feature completion (Phase 5) | SMS full integration, medical acts recall columns |
| 7–9 | Bug fixes + hardening | Resolve F1–F7 + edge cases |
| 10–12 | Performance + migration | Optimize full-table reads (Supabase 10K rows), migrate phone fields from decimal to text |
| 13–14 | Documentation + handoff | Staff guide, deployment checklist |
| 15–26 | Future: RDC/TiMAWI integration | Credit system, cross-institution patient sharing, unified tables |

## Known Open Bugs (Post-Phase 4)

1. Appointment list only returns "now onward" → appointments before API call time disappear from "Today"
2. Password with `:` still breaks `authRequest` (old sessions) vs new login with `|`
3. `invEmail` and `editInvoice` send credentials in URL query string (should use header)
4. Cron SMS can send duplicates (same appointment appears twice at 13:00 + 18:00)
5. No appointment delete/reschedule UI
6. Invoice math is client-side, server doesn't validate totals
7. No per-user authentication or audit trail (invoice history lacks "who")
8. Reports procedures column has inline `nowrap` (fixed by `theme.css` media query)

## Success Metrics

1. **Staff efficiency:** New appointments created in <60s, patient edits completed in <45s
2. **Invoice accuracy:** Zero cumulative math errors after client-side validation + server-side freshness check
3. **SMS deliverability:** >95% delivery rate, opt-out respected, bi-daily reminders on time
4. **Mobile responsiveness:** Tablet experience comparable to desktop (split-pane collapses to tab/stack)
5. **Sync reliability:** No data loss between Supabase and Google Sheets (reconcile runs nightly at 02:00 UTC)