# UI Audit — FieldOps Manager

> Status: Phase 1 audit. Critical and High items marked for immediate implementation.
> Date: 2026-06-19

---

## Critical

| # | Finding | Affected | Fix |
|---|---------|----------|-----|
| C1 | `.input`, `.label`, `.btn`, `.btn-primary` CSS classes referenced in 30+ places but **never defined** — all form inputs render with unstyled browser defaults | All pages with forms | Add `@layer components` block to `index.css` |
| C2 | Table row hover uses `background: var(--bg)` — the exact same colour as the page background, making hover state invisible | All tables | Change to `#f0f4ff` (subtle blue tint) |

---

## High

| # | Finding | Affected | Fix |
|---|---------|----------|-----|
| H1 | Page titles use `text-xl font-bold` — too small for a primary heading at typical viewport widths | All dashboards + page headers | Change to `text-2xl font-bold` |
| H2 | `CardTitle` uses `text-sm font-semibold` — card headings are the same visual weight as body text, killing hierarchy | All Card components | Change to `text-base font-semibold` |
| H3 | `EmptyState` component accepts no subtitle — empty states only show a small icon and one line of text with no guidance | All list/table pages | Add `sub` prop for descriptive text |
| H4 | `MetricCard` has no hover transition when wrapped in a `<Link>` — the hover shadow is on the outer `<Link>`, not the card, causing a brief flicker | TLDashboard, EngDashboard | Add `transition-all duration-200` directly to the card div |
| H5 | `StoreDashboard`, `TLDashboard` have no page subtitle below the title — unclear what time period or scope the data covers | Store Manager, Team Leader | Add `<p className="text-sm text-muted">` subtitle |
| H6 | `StoreDashboard` purchase table has no empty state — when `recentPurchase` is empty the table renders an empty `<tbody>` | Store Manager Dashboard | Add `EmptyState` with `sub` text |
| H7 | SuperAdminMonitoring `ACTION_LABELS` was 27 entries and missing `ORGANISATION_CREATED`, `PRODUCTIVITY_APPROVED`, `PRODUCTIVITY_REJECTED_BY_ADMIN` — same drift that was fixed on the Audit Logs page | Super Admin Monitoring | Sync label maps |

---

## Medium

| # | Finding | Affected | Fix |
|---|---------|----------|-----|
| M1 | `AdminDashboard.StatTile` hover only adds `shadow-md` with no lift — modern card interactions use `translateY` | Admin Dashboard | Add `hover:-translate-y-0.5 hover:shadow-lg` |
| M2 | "Tap to review →" affordance on stat tiles uses `opacity-50` text — barely readable, not recognised as a CTA | Admin Dashboard | Increase to `opacity-60` + use icon arrow |
| M3 | `Alert` component has no title support — warning/danger messages are wall-of-text | All pages | Add optional `title` prop |
| M4 | `select.input` uses default browser arrow chevron — inconsistent across browsers (Chrome OK, Firefox different) | All pages with selects | Add SVG chevron background-image in CSS |
| M5 | Forms using `<textarea className="input">` lose the `display: block; width: 100%` behaviour because `<textarea>` inherits inline display | LP/Claim forms | The CSS `.input` definition now sets `display: block; width: 100%` |
| M6 | `AdminAuditLogs` and `AdminAttendanceLedger` filter grids use `grid-cols-2 sm:grid-cols-4` but on 320px the 2-column grid stacks correctly — OK | Admin Audit Logs | Acceptable |
| M7 | `SuperAdminUsers.jsx` filter bar uses `flex gap-2` — overflows horizontally on narrow mobile | Super Admin Users | Change to `flex flex-col sm:flex-row gap-2` |
| M8 | `TLDashboard` engineer table has no empty state — if there are no engineers, the table just shows empty rows | Team Leader Dashboard | Add EmptyState |
| M9 | `AdminDashboard` inventory card shows `lowStockItems.slice(0, 8)` with a text note `+N more` — no link to full inventory | Admin Dashboard | Add a "View all →" link to `/admin/inventory` |
| M10 | Most page headers use `mb-5` but some use `mb-4` or `mb-3` — minor spacing inconsistency | Multiple pages | Standardise to `mb-6` for page header block |

---

## Low

| # | Finding | Affected | Fix |
|---|---------|----------|-----|
| L1 | `Badge` uses `text-xs` — at 10px rendered size, badges are hard to read on mobile | All pages | Already `text-xs` (12px) — acceptable |
| L2 | `IncentivePill` uses `#fef3c7 / #92400e` hardcoded hex instead of Tailwind token | Multiple pages | Refactor to `bg-amber-100 text-amber-800` |
| L3 | `PageSpinner` is a full-page block spinner — long loading states feel frozen with no skeleton | All data pages | Replace with skeleton cards (future sprint) |
| L4 | `Topbar` uses `text-base font-semibold` for page title — could match sidebar active item label better | Global | Minor |
| L5 | Charts (BarChart) use hardcoded hex for colours instead of CSS variables — won't adapt to theme changes | Eng/TL Dashboards | Refactor to use CSS variables as SVG fill |
| L6 | `ConfirmDialog` `max-w-sm` (384px) may be tight on very narrow mobile for long message text | All confirm dialogs | Change to `max-w-md` or allow text to wrap |
| L7 | Table `th` `letter-spacing: 0.5px` is correct; however some TH cells have very long labels (`Purchase Inward (Pending Admin)`) that cause awkward wrapping | Store Dashboard | Shorten label to `Pending Approval` |
| L8 | No `loading="lazy"` on any images — n/a since app is icon-only | — | N/A |
| L9 | No `aria-label` on icon-only buttons (icon-only revoke, enable/disable buttons in tables) | Admin, SA pages | Add `aria-label` to icon buttons |
| L10 | `SuperAdminOrgs` "New Org" button shows `Plus` from lucide but other action buttons use Tabler `ti-*` icons | SA Orgs | Standardise to one icon library per file |

---

## Implementation Notes

- **C1 (CSS classes):** Implemented in this sprint via `@layer components` in `index.css`
- **C2 (table hover):** Implemented — changed to `#f0f4ff`
- **H1–H7:** Implemented in this sprint
- **M1–M2:** Implemented in AdminDashboard StatTile
- **M4:** Implemented via `select.input` background-image in CSS
- **M7:** Deferred to next sprint
- **Remaining Medium/Low:** Deferred — document in polish completion report
