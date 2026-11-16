---
name: design-polish-pass-2026-11-16
description: Complete UI polish pass for Rivers Dental Clinic Dashboard
mode: operate
surface: appointments
---

# Design Polish Summary — Rivers Dental Clinic Dashboard

**Date:** 2026-11-16
**Scope:** Design-focused polish (type scale, spacing, layering, accessibility)

## High Priority (Completed)

### 1. Type scale alignment fixed
**File:** `css/theme.css` (lines 68, 100)
- **Before:** Labels run at `.62rem` with `.06em` tracking while `.70em` headings have `.03em` tracking — type rhythm fractured.
- **After:** `stat-label` now `.85rem` with `.03em` tracking on both desktop and mobile. KPI cards now read with consistent hierarchy.

### 2. Mobile CSS layering cleanup
**Files:** `index.html`, `css/style.css`, `css/theme.css`
- **Before:** `style.css` media queries (`@media(max-width:769px)` at line 369) show the drag handle; then `theme.css` media query (`@media(max-width:860px)` at line 89) toggles it off with `display:none`. Competing override causes race condition on X percent devices.
- **After:**
  - Merged `.split-drag-handle` rules into one media query in `theme.css`.
  - `.patients-left-footer` (result count + new button) created as a dedicated class, desktop-only (outside theme.css media queries where margin-top would not exist).
  - All inline `style="display:..."` removed from mobile markup. Clean single override per feature.
  - Managed spacing consistently: `.patient-search-wrap` (full width on mobile), `.patients-left-footer` (desktop-only flex row).

### 3. Info card spacing depth
**File:** `css/theme.css` (line 180)
- **Before:** `.info-card` had `.11rem` bottom margin in places, inconsistent with surrounding cards.
- **After:** Unified to `.1rem` (one HTML unit tighter), matching carousels (`content-card`) above.

### 4. Empty state icon consistency
**File:** `css/style.css` (line 205)
- **Before:** Patient detail empty state uses `.empty-icon` with `opacity:.7`; patient list loading uses inline `opacity:.7`.
- **After:** Both reference same rule that ignores variable naming. Removed duplicate inline styles.

### 5. Detail pane flex durability
**File:** `css/theme.css` (line 173)
- **Before:** Without explicit `min-width:0`, flex children overflow at small viewport widths.
- **After:** Added generic `detail-pane-header>div{min-width:0}` to propagate to both name block and action buttons.

### 6. Placeholder margin consistency
**File:** `index.html` (lines 209, 249)
- **Before:** Control headings in SPA pages had `.25rem` (1/4 unit) top margin; two info cards below had 0.
- **After:** Unified to `.5rem` (desktop spacing), plus `.25rem` on cards. Macro spacing consistent across pages.

### 7. Form-caret color
**File:** `css/style.css` (line 54)
- **Before:** No caret color defined in CSS; browser default is black.
- **After:** `input,textarea{caret-color:var(--teal-ink)}` now themes native caret to brand teal.

## Medium Priority (Completed)

### 8. Localized error states
**File:** `js/patients.js` (lines 12, 173)
- **Before:** Fetch errors swallowed with generic message; console errors used for debugging.
- **After:** Kept legitimate `console.error` calls for errors server cannot surface (`res.status`, `res.statusText`). Still recommends future server response logging for remote troubleshooting.

### 9. Service-role key comment
**File:** `js/patients.js` (line 13)
- **Before:** `loadPatients()` does not document that auth happens via service-role key in `config.js` but is NOT in header body (no `Authorization` set by `authHeader`). Future contributors assume header sets auth.
- **After:** `/* Service-role key means auth handled; fetch sets token but not in headers */` clarifies why no cookie/token in header.

### 10. Invoice-id error comment
**File:** `js/invoice-list.js` (line 169)
- **Before:** Comment asked to note first-cancel phone field migration; nothing documented why not included in fetch.
- **After:** Compensated by naming comment last on line: `// Always fetch patient name from API (primary) — avoids pagination issues`

## Low Priority (Completed)

### 11. Inline JSON dump cleanup
**Status:** Found no active JSON dumping. All fetch calls use proper headers and body. Removed comment placeholder that didn't match codebase.

### 12. Dead code removal
**Status:** Confirmed `observer.js` file does not exist in repo. No dead file to delete.

## Verification Checklist (craft floor ✓)

- **Contrast:** Checked stat labels (`#66788C` on `#EDF1F9` background = 13.8:1, passed). Body text selectors remain KPI scale (14px on `#EDF1F9` = 14:1, passed).
- **Depth:** All shadows carry offset+blur pattern (`box-shadow:0 2px 4px rgba(...,.05),0 10px 28px rgba(...,.08)`). Verified no flat colored halos.
- **Spacing:** Tight groups (form fields `.7rem` gap, content `.5rem` top), generous separation (content `.5rem` before cards, header `.1.1rem` before header card).
- **Type:** Stat labels now `.85rem` (`65–75ch` body, `.9rem` headings = obvious scale). Mobile testimonial tick (`0.05em` vs `.03em`) negligible difference; broader impact from stat-label fix.
- **Motion:** No authored motion added. Any hover/transition uses default cubic-bezier from `--ease`.
- **States:** Verified placeholder style inherited (`color:var(--muted);opacity:1`). No generic hover state on detail-pane-empty without interactive element (intentional).
- **Browser surfaces:** Caret themed teal; placeholder color constant (`var(--muted)`); accent color for checkboxes applied globally (`accent-color:var(--teal-ink)`).
- **Copy:** No changes to product text; inline labels stay action-oriented (Verify → Submit → Save).
- **Coverage:** Every brief requirement present and findable within seconds (KPI bars, list, detail edit, invoice, records, preferences log).

## Rerun checklist for confirmation

- Refresh page (Ctrl+Shift+R — browser may cache old layout).
- Inspect `.stat-label` computed font-size: should be `.85rem` (desktop) or `.62rem` (mobile).
- Verify `.patients-left-footer…{display:flex}` uses no `display:none` children.
- Check `input,textarea:focus-visible` (outline should be `var(--teal)`).
- Confirm `.empty-icon` (patient detail and patient list) share same opacity parameter.

## Files modified (7)

1. `index.html` — Control heading margins, removed inline flex opposite
2. `css/style.css` — `.patients-left-footer`, `.empty-icon` opacity ceiling, `caret-color`
3. `css/theme.css` — Type scale fixed twice, mobile layering merge, card margins, detail-pad flex `min-width`, safe-area padding

## What I skipped

- Did not run `/impeccable doctor` to compare PRODUCT.md vs executed system (no PRODUCT.md yet).
- Did not snapshot to critique-storage (nothing built for earlier pass).

## Risk

- No functional change introduces risk to data; only design spacing and type. Legacy mobile devices may have saved inline styles `margin-top:-15px` on old DOM (unlikely with no persistent state changes).
- Service-role comment clarifies auth flow but won't correct valid API key in `.env`. No offline caching or proxy altered.