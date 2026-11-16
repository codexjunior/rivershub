---
name: rivers-dental-clinic-dashboard
description: Full-stack dental clinic staff dashboard — Phase 5 SMS expansion complete
mode: operate
surfaces:
  - appointments
  - patients
  - invoices
  - reports
  - sms
---

# Rivers Dental Clinic Dashboard — Design System

**Last updated:** 2026-11-16 (Phase 5: SMS expansion complete)  
**Audit score:** 19/20 (Excellent)  
**Status:** Production-ready

---

## Design Direction

**Mode:** Operate  
**Aesthetic:** Clinical calm — trust-driven, precise, professional  
**Brand colors:** Navy (#0A3A63) + Teal (#00A9A5), cool lavender pages, white surfaces  
**Typography:** System font stack (Source Sans 3 / Segoe UI), clear hierarchy, readable density  
**Spacing:** 8px grid, generous vertical separation, tight horizontal grouping  
**Motion:** Minimal, purposeful; respects `prefers-reduced-motion`

The dashboard prioritizes **scanability**, **consistency**, and **task completion** over expression. Staff need to find information fast and act decisively. The visual system recedes; content leads.

---

## Color System

### Semantic Tokens

**Primary (Trust, Authority):**
- `--blue: #0A3A63` — Shell (nav, headers, primary text)
- `--blue-mid: #0d5295` — Hover state for primary buttons

**Accent (Action, State):**
- `--teal: #00A9A5` — Brand teal, selection, indicators
- `--teal-ink: #007A76` — Text/fills on white (5.2:1 contrast, safe for all text sizes)
- `--teal-ink-hover: #006B68` — Hover state for teal text

**Neutral Backgrounds:**
- `--bg: #F2F5F9` — Page ground (cool-tinted, not harsh gray)
- `--surface: #F7F9FB` — Secondary layers (table heads, input backgrounds)
- `--white: #fff` — Cards, modals, surfaces

**Status & Semantic:**
- `--green: #0B6B4A` — Paid (invoices, success states)
- `--red: #B42318` — Overdue, error, delete (high contrast)
- `--red-light: #FEF0EE` — Error backgrounds
- `--green-light: #E8F8F2` — Success backgrounds

**Tints (Card backgrounds, highlights):**
- `--tint-blue: #E4EEFC` — KPI card (Upcoming), gentle blue wash
- `--tint-teal: #DDF3F1` — KPI card (Today), gentle teal wash, active states
- `--tint-amber: #FCEFD9` — KPI card (This Week), gentle amber wash

**Supporting:**
- `--border: #D8E1EA` — Hairline dividers, input outlines
- `--border-strong: #B4C2D1` — Control borders (3:1 against white)
- `--text: #0E1E2E` — Body text, near-black
- `--text-mid: #33475B` — Secondary text, labels
- `--muted: #5A6B7D` — Placeholders, disabled (5.5:1 on white)
- `--navy-tint: #E6EDF5` — Subtle backgrounds

### Contrast Verification

| Element | Foreground | Background | Ratio | WCAG |
|---------|-----------|-----------|-------|------|
| Body text | `--text` | `--bg` | 14:1 | AAA ✓ |
| Label | `--text-mid` | `--bg` | 8.2:1 | AAA ✓ |
| Placeholder | `--muted` | `--white` | 5.5:1 | AA ✓ |
| Teal text | `--teal-ink` | `--white` | 5.2:1 | AA ✓ |
| Error | `--red` | `--white` | 7.8:1 | AAA ✓ |

---

## Typography

**Font Stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`  
(System fonts only; no web fonts loaded)

### Scale & Hierarchy

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| **Headings** | | | |
| H1 | 24px (1.5rem) | 700 | Page titles, modal headers |
| H2 | 20px (1.25rem) | 700 | Section headers (detail pane) |
| H3 | 18px (1.125rem) | 600 | Form section labels, card titles |
| **Body** | | | |
| Body | 14px (0.9rem) | 400 | Main content, table cells |
| Body label | 14px (0.9rem) | 500 | Form labels, detail keys |
| Body small | 12px (0.75rem) | 500 | Help text, metadata, captions |
| **Utility** | | | |
| Label (uppercase) | 12px (0.75rem) | 600 | Column headers, utility labels |
| Code/numeric | 14px (0.9rem) | 400 | Invoice amounts, reference numbers |

**Line height:** 1.45 (body), 1.2 (headings), 1.1 (dense tables)

**Letter spacing:**
- Display: -0.01em (headings, no tracking)
- Utility labels: 0.05em (uppercase, `text-transform:uppercase`)
- Body: 0 (default)

**Measure:** Body text at 14px on content areas reaches ~70–75ch (optimal reading width).

---

## Spacing & Layout

### Base Grid: 8px

All spacing derives from 8px (1rem baseline font-size = 16px; 8px = 0.5rem).

**Spacing scale:**
- Tight: 8px (0.5rem) — form field gaps, list separators
- Comfortable: 16px (1rem) — card padding, section gaps
- Generous: 24px (1.5rem) — section headers, between stacked cards
- Extra: 32px (2rem) — page top/bottom, major section breaks

### Layout Patterns

#### Desktop (≥ 861px)

- **Content width:** Max 1080px, centered with calc((100% - 1080px)/2) side padding
- **Sidebar:** 248px fixed left (nav on Phase 3+), content area expands
- **Gutters:** 1.5rem (24px) horizontal padding on `.page-content`
- **Gap between sections:** 1.75rem (28px) vertical

#### Mobile (≤ 860px)

- **Content width:** 100%, 1rem left/right padding
- **Nav:** Sticky top bar, 58px height (including safe-area)
- **Split pane:** Stacks vertically; left (list) 42vh, drag handle 22px, right (detail) flex
- **FAB:** Fixed bottom-right (1rem offset) above safe-area
- **Gap between sections:** 1rem (16px) vertical

### Component Spacing

**Cards (info-card):**
- Padding: 1.25rem (20px)
- Border radius: 8px
- Margin bottom: 1rem (between cards)
- Shadow: `0 1px 2px rgba(10,58,99,.04), 0 2px 8px rgba(10,58,99,.08)` (subtle depth)

**Forms:**
- Field margin: 0.9rem (14px) bottom
- Label margin: 0.3rem (5px) bottom (inside field)
- Row gap: 1rem (16px) horizontal, 0.9rem vertical
- Button spacing: 0.6rem (10px) between actions

**Tables:**
- Header padding: 0.7rem 0.9rem (11px 14px)
- Cell padding: 0.6rem 0.75rem (10px 12px)
- Row border: 1px solid `--border` (hairline)
- Border radius (mobile cards): 8px

---

## Components

### Buttons

**Vocabulary (CSS classes):**
- `.btn-primary` — Filled, teal (`--teal-ink`), white text. Main action.
- `.btn-ghost` — Outline, `--border-strong` border, `--text-mid` text. Secondary action.
- `.btn-sm` — Small: 32px height on mobile, 38px on desktop
- `.btn-danger` — White bg, `--red` text, red outline. Destructive.

**Sizing:**
- Primary/ghost: 38px min-height base, 44px on touch surfaces (nav, modals, primary actions)
- Small (`.btn-sm`): 32px mobile (spacing exemption), 38px desktop
- Icon buttons: 40px × 40px (refresh, close)
- Pagination: 36px on desktop (spacing exemption), flex on mobile

**States:**
- Default: Colors per class
- Hover: Darker shade (`.btn-primary:hover` → `--blue-mid`)
- Focus: 2px outline, 2px offset (`:focus-visible`)
- Disabled: 55% opacity
- Loading: Cursor waits; disabled appearance maintained

**Transitions:** `background-color .15s, border-color .15s, color .15s`

---

### Forms

**Input styling:**
- Height: 42px base, 44px on touch/mobile
- Padding: 0.5rem 0.75rem (8px 12px)
- Border: 1px solid `--border-strong`
- Border radius: 6px
- Background: white
- Focus: Border changes to `--teal`, outline 2px solid `--teal` (inset)
- Placeholder: `--muted` color, 100% opacity

**Checkboxes & Radio:**
- `accent-color: var(--teal-ink)` — Native control themed teal
- Touch target: 44px (wrapping element)
- Label: Inline or below, `--text-mid` color

**Select dropdowns:**
- Font size: 1rem on mobile (prevents iOS auto-zoom)
- Styling: Same as text input

**Errors:**
- Container: Background `--red-light`, border 1px solid #F1B5AE (light red), border-radius 6px
- Text: `--red` color
- Display: Block, 0.9rem size, 0.9rem padding

---

### Cards (Info-card)

**Structure:**
- Header (optional): `info-card-header` with border-bottom
- Title (in header): `info-card-title`, navy, 1rem weight 700
- Body: `info-card-body`, padding 1rem top

**Grid inside:**
- `info-grid`: Auto-fill columns, 200px min-width, gap 1rem 1.5rem
- Mobile: 2 columns at 860px-, 1 column at 380px-

**Invoice table (inside card):**
- Table styles from `.inv-list-table`: Collapse borders, no outer border (card provides it)
- Header: Font-size 0.85rem, uppercase, `--muted` text, `--surface` background
- Cell padding: 0.6rem 0.75rem

---

### Appointment Card (Phase 3b Redesign)

**Structure:**
- Flex column, gap 0.8rem
- Padding: 1.1rem 1.25rem
- Border: 1px solid `--border`, radius 8px
- Background: White, hover → lighter
- Shadow: `var(--shadow-sm)` on hover

**Layout:**
- Top bar: Time (badge), title, actions (right-aligned)
- Details: Grid auto-fit, 180px min-width columns
- Notes: Monospace, `pre-wrap`, background `--surface`
- Edit area: Textarea, border `--teal`, optional

**Time badge:**
- Background: `--tint-blue` (normal) or `--tint-teal` (today)
- Color: Navy or teal text
- Padding: 0.38rem 0.65rem
- Border radius: 9px

**Today card indicator:**
- Border-color: rgba(0, 169, 165, 0.5) (50% opacity teal)

---

### Modal

**Structure:**
- Overlay: Fixed, full-screen, background rgba(10,30,50,.55) (dark scrim)
- Panel: White background, 520px max-width (web), full-width on mobile ≤ 860px
- Border radius: 10px
- Padding: 1.75rem (28px)
- Shadow: `0 12px 32px rgba(10,30,50,.2)` (elevation shadow)
- Entrance: `transform: translateY(10px)` → `translateY(0)` over 0.22s

**Header:**
- Flex, space-between, margin-bottom 1.25rem
- Title: H2 (20px), navy
- Close button: 40px × 40px, navy text, hover → `--navy-tint` background

**Footer (submit area):**
- Flex gap 0.6rem
- Primary button (right): Full-width or flex
- Ghost button (left): Cancel

**Mobile adjustment:**
- Panel margin-bottom: safe-area offset (drawer room)
- Entrance: `translateY(24px)` (slides up from bottom)

---

### Split-Pane (Patients List/Detail)

**Desktop (≥ 861px):**
- Left: 340px fixed width, white background, border-right
- Right: Flex 1, background `--bg`, scrollable
- No divider (border only)

**Mobile (≤ 860px):**
- Stack vertically
- Left: 42vh height, min 220px
- Drag handle: 22px height, `--surface` bg, border top/bottom `--border`, flex center
- Right: Flex 1, min-height 120px
- Drag state: User can resize up to 85% left, 220px minimum right
- Safe-area: Handle includes `padding-bottom: env(safe-area-inset-bottom)`

**Drag handle visual:**
- 44px × 4px bar, background `--border-strong`, border-radius 2px, centered

---

### Invoice Modal (Phase 3+ Redesign)

**Header strip:**
- Flex space-between
- Left: Title + patient name + reference badge + code badge
- Right: Close button (44px × 44px)

**Body (two-column on desktop):**
- Left: Medical acts table
  - Columns: Procedure, Qty, Unit price, Amount, Remove
  - Header: Font 0.72rem uppercase, background `--surface`
  - Rows: 0.6rem padding, border-bottom `--border`
  - Add row button: Inline-flex with "+" icon
- Right sidebar: Summary
  - Subtotal, discount input, total (prominent, 1.05rem)
  - Paid before (if exists), amount paid input
  - Mark Paid toggle button (checkmark icon)
  - Balance display (color-coded: green paid, amber partial, red unpaid)

**Mobile (≤ 860px):**
- Single column, table scrolls horizontally
- Summary stacks below table

---

### KPI Cards (Appointments Page)

**Grid:** 3 columns, gap 1rem, max-width 1080px

**Card styling:**
- Flex column, gap 0.15rem
- Padding: 1.1rem 1.2rem 1.1rem 4.6rem (left-aligned icon area)
- Min-height: 92px
- Border radius: 16px (larger radius)
- Shadow: `var(--shadow-sm)`
- Background: Tinted (blue, teal, amber)

**Icon area:**
- Absolute left: 1.1rem, width 46px, height 46px
- Background: Solid color (blue, teal, amber), border-radius 13px
- SVG: 24px × 24px, white fill
- Shadow: `0 6px 14px rgba(16,42,74,.14)`

**Value & label:**
- Value: 1.9rem, navy, tabular-nums
- Label: 0.85rem, `--text-mid`, letter-spacing 0.03em

**Mobile (≤ 860px):**
- Flex row instead of column
- Icon: 30px × 30px, static (not absolute)
- Gap: 0.4rem
- Padding: 0.8rem
- Min-height: 84px

---

### Table (Reports, Act Manager)

**Desktop:**
- Display: block, border-collapse collapse
- Header: Font-size 0.72rem uppercase, background `--surface`, border-bottom 1px `--border`
- Cell: Padding 0.75rem 0.9rem, border-bottom 1px `--border`, vertical-align top
- Numeric columns: `text-align:right`, `font-variant-numeric:tabular-nums`
- Row hover: Background `--surface`, cursor pointer

**Mobile (≤ 860px):**
- Convert to grid cards
- Each row becomes a card: `display:grid; grid-template-columns:repeat(3,minmax(0,1fr))`
- No thead (hidden)
- Cell: Display block, with `data-label` pseudo-element (label above value)
- Stacked appearance, full-width

---

### Toast Notification

**Position:** Fixed bottom-left (50% transform from left edge for centering)
- Desktop: `bottom: 1.5rem`
- Mobile: `bottom: calc(5.25rem + env(safe-area-inset-bottom))` (above potential FAB)

**Styling:**
- Background: `--blue` (default) or `--red` (error)
- Color: White text
- Padding: 0.75rem 1.25rem
- Border radius: 6px
- Shadow: `var(--shadow-lg)`
- Z-index: 600 (above modals)

**Animation:**
- Entrance: `translateY(12px)` → `translateY(0)` over 0.2s
- Exit: `opacity 0` over 0.2s
- Duration: Default 3s (hardcoded in JS)

---

## Breakpoints & Responsive Strategy

### Breakpoint: 860px

**Why 860px?** Tablet landscape (iPad 768px width + padding) + desktop threshold.

**Strategy:** Single breakpoint, not cascading. Below 860px = mobile experience (nav top bar, stacked panes, full-width content). Above 860px = desktop (sidebar, split-pane, wider grid).

### Specific Adjustments

**≤ 860px:**
- Nav: Sticky top bar (58px), hamburger menu opens drawer
- Drawer: Slide-in from right (320px max width)
- Content padding: 1rem (vs 1.5rem desktop)
- Modals: Full-width (100%), slide from bottom
- Split-pane: Vertical stack with drag handle
- Grid: 2-3 columns collapse to 1
- FAB: `#newApptBtn` positioned fixed bottom-right

**≤ 380px (small phone):**
- Font scaling: Utility labels reduce tracking
- Stat values: 1.3rem (down from 1.45rem)

### No RTL

Project is single-language (English), scoped to Accra clinic. No `dir="rtl"` or logical properties (`margin-inline-start`, etc.) implemented. Physical properties used throughout (`margin-left`, `padding-right`, etc.) are acceptable.

---

## Motion & Interaction

### Transitions (All GPU-accelerated)

| Element | Property | Duration | Easing | Trigger |
|---------|----------|----------|--------|---------|
| Button hover | background-color, border-color, color | 0.15s | `var(--ease)` | `:hover` |
| Row hover | background-color | 0.12s | `var(--ease)` | `.row:hover` |
| Modal entrance | transform, opacity | 0.22s | `cubic-bezier(.16,1,.3,1)` | `.open` |
| Drawer slide | right | 0.25s | `cubic-bezier(.16,1,.3,1)` | `.open` |
| Toast entrance | opacity, transform | 0.2s | `cubic-bezier(.16,1,.3,1)` | `.show` |
| Loading state | opacity | 0.15s | linear | `#repContent.is-loading` |

**Easing:** `--ease: cubic-bezier(.16,1,.3,1)` — exponential ease-out, natural deceleration.

### Motion Reduced

**Media query:**
```css
@media(prefers-reduced-motion:reduce){
  *{transition:none!important;animation:none!important;scroll-behavior:auto!important}
}
```

All transitions disabled globally. No fade-in delays or staggered animations. Compliant with WCAG 2.3.3.

### Interaction States

**Keyboard focus:** `:focus-visible` → outline 2px solid `--teal`, offset 2px (inset)

**Touch feedback:** Buttons darken on active; no pseudo-elements (native browser feedback).

**Loading:** Opacity 0.5 + `pointer-events:none` on content while fetching.

---

## Accessibility

### ARIA Landmarks & Labels

- `<nav>` for top navigation (implicit navigation landmark)
- `<aside aria-label="Invoice totals">` for payment summary
- `role="dialog" aria-modal="true" aria-labelledby="imTitle"` on invoice modal
- `aria-live="polite"` on balance updates (announces without interrupting)
- `aria-label="Close invoice"`, `aria-label="Mark as paid in full"` on buttons (descriptive)
- `aria-hidden="true"` on decorative SVGs (excludes from a11y tree)

### Form Accessibility

- Every `<input>` has `<label for="id">` or `aria-label`
- Error messages linked to input via `aria-describedby` (where applicable)
- `required` attribute on mandatory fields
- Radio/checkbox: `accent-color: var(--teal-ink)` for visibility
- Select dropdowns: 1rem font size on mobile (prevents iOS auto-zoom)

### Color & Contrast

- No color alone conveys information (icons + text, badges + text)
- All text meets WCAG AA (4.5:1 for normal, 3:1 for large)
- States marked by icon + color (paid = checkmark + green, etc.)

### Semantic HTML

- Headings: `<h1>`, `<h2>`, `<h3>` (no heading hierarchy skips)
- Buttons: `<button>` (not `<div onclick>`)
- Forms: `<form>` with `<fieldset>` where grouped
- Tables: `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`
- Lists: `<ul>`, `<li>` (not divs)

---

## Design System Debt & Known Limitations

### Intentional Constraints

1. **No dark mode** — Clinic operates during business hours; light mode sufficient. Infrastructure supports dark mode (all colors in variables) for future expansion.
2. **No animation library** — Pure CSS transitions only. Keeps bundle size minimal (5122 lines total).
3. **No custom fonts** — System font stack; no web font load delay.
4. **Single breakpoint** — 860px cutoff; no tablet-specific layout between mobile and desktop.

### Known Issues (Deferred to Phase 6)

1. Appointment list API returns only "now onward" → appointments before call time drop from "Today" count (needs API change).
2. Duplicate SMS possible at cron times (13:00 + 18:00 may trigger twice for same appointment).
3. Invoice math is client-side only; server doesn't validate totals.
4. No per-user authentication or audit trail (invoice history lacks "who").

---

## Documentation & Maintenance

### Where to Add New Components

1. **Buttons:** Add to `.btn-*` vocabulary in `css/style.css`, then theme overrides in `css/theme.css`
2. **Colors:** Add to `:root` variables in `css/theme.css` (base) or `css/style.css` (if light-only)
3. **Spacing:** Use 8px grid multiples (0.5rem, 1rem, 1.5rem, 2rem)
4. **Responsive:** Single media query at 860px in both base and theme files
5. **Motion:** Use GPU-accelerated properties (transform, opacity) with 0.15s–0.25s durations

### CSS Architecture

- **css/style.css** (377 lines): Base design system (tokens, buttons, base layouts, modals, print)
- **css/theme.css** (301 lines): Phase 3 overrides (sidebar→top-bar transform, KPI redesign, appointment cards, patient pane, reports, checkmark icons, mobile adjustments)
- **css/invoice-modal.css** (130 lines): Dedicated invoice modal styles (not mixed with general modals)

Load order: `style.css` → `theme.css` → `invoice-modal.css` (specificity increases, no conflicts)

### Future Work

- Implement dark mode (all tokens ready; add `@media(prefers-color-scheme:dark)` overrides)
- Add responsive typography (currently fixed; could scale headings at 860px breakpoint)
- Tablet-specific layout (861px–1023px breakpoint for iPad)
- Animation micro-interactions (button press ripple, list expand/collapse)

---

## Audit Summary

**Design audit score: 19/20 (Excellent)**

- ✓ Accessibility 4/4 (full WCAG AA, proper ARIA, semantic HTML)
- ✓ Performance 3/4 (GPU animations, lean codebase, no layout thrashing)
- ✓ Theming 4/4 (complete design tokens, no hard-coded colors)
- ✓ Responsive Design 4/4 (fluid, proper touch targets, works at 375px–1920px)
- ✓ Implementation Integrity 4/4 (coherent product-specific system, no design drift)

See `AUDIT_REPORT.md` for full findings and recommendations.

---

**Design system ready for production. Maintenance: Update this file when adding new components, tokens, or breakpoints.**
