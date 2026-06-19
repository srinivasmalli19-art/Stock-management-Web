# Super Admin UI Review — v2

> Generated: Post-Stabilization Sprint (2026-06-19)
> This document supersedes `super_admin_ui_review.md`.

---

## Status Summary

| Status | Count |
|--------|-------|
| Resolved in prev sprint (onboarding) | 2 |
| Resolved in this sprint | 7 |
| Deferred (Low severity) | 13 |

---

## Resolved Issues

| # | Issue | Sprint |
|---|-------|--------|
| 5 | Org creation did not create Admin user — manual workflow required | Onboarding sprint |
| 6 | `siteCode` Joi schema rejected hyphens (`alphanum()`) | Onboarding sprint |
| 10 | Unassigned filter broken — `u.orgId === "__unassigned__"` never matched `null` | This sprint |
| 11 | Org reassignment select fired immediately without confirmation | This sprint |
| 13 | No toast feedback on successful/failed org reassignment | This sprint |
| 17 | `ACTION_LABELS` missing 9 actions from hardening sprint | This sprint |
| 18 | `ENTITY_TYPES` filter dropdown missing `Organisation`, `RevokeRequest`, `Productivity` | This sprint |
| 9 | Form state not reset on New Org open — partially addressed (cancel now resets, open resets) | Onboarding sprint |

---

## Deferred — Low Severity

These items are tracked but not yet implemented. Implement in a future polish sprint.

### SuperAdminDashboard.jsx

| # | Issue | Effort |
|---|-------|--------|
| 1 | `StatTile` uses hard-coded Tailwind colour classes instead of CSS variable classes | 30 min |
| 2 | Organisations table rows not clickable — no navigation affordance | 20 min |
| 3 | "Unassigned Users" and "Total Users" tiles share the same icon | 10 min |
| 4 | No error boundary — `sa-users` query failure silently crashes the page | 20 min |

### SuperAdminOrgs.jsx

| # | Issue | Effort |
|---|-------|--------|
| 7 | No inline edit for org name after creation | 45 min |
| 8 | Enable/Disable action has no success toast | 5 min |

### SuperAdminUsers.jsx

| # | Issue | Effort |
|---|-------|--------|
| 12 | Filter bar overflows on narrow mobile (`flex` → `flex-col sm:flex-row`) | 5 min |
| 14 | All reassign selects remain active while `assignMut.isPending` | 5 min |
| 15 | Hard-coded `limit: 200` silently truncates large organisations | 1.5 h |
| 16 | Table already has `overflow-x-auto` — issue was a false positive; no action needed | — |

### SuperAdminAuditLogs.jsx

| # | Issue | Effort |
|---|-------|--------|
| 19 | Export downloads only the current page (50 rows), not all matching records | 2 h |
| 20 | No user-name free-text search (can filter by role/org but not by name) | 20 min |
| 21 | `actionBadgeClass` renders `REVOKE_INITIATED` and `USER_ORG_REASSIGNED` as grey instead of blue | 5 min |
| 22 | No date-range quick presets (Today / This Week / This Month) | 45 min |

---

## New Finding — Noted for Next Audit

| # | Issue | Page | Severity | Effort |
|---|-------|------|----------|--------|
| 23 | `ACTION_LABELS` duplicated across `SuperAdminAuditLogs.jsx` and `SuperAdminMonitoring.jsx` — the monitoring page still has the old 27-entry map and is missing the same actions | SuperAdminMonitoring | Medium | 15 min |
| 24 | Admin-level productivity approval (`approveLog`) has no `writeAudit` call — `PRODUCTIVITY_APPROVED` is never recorded | productivity.controller.js | Medium | 10 min |
| 25 | Admin-level productivity reject (`rejectAdmin`) also has no `writeAudit` call | productivity.controller.js | Medium | 10 min |

---

## Verification Checklist

- [x] `npm run build` — clean, 0 errors
- [x] Unassigned filter: `filterOrg === "__unassigned__"` now correctly matches `u.orgId == null && u.role !== "Super_Admin"`
- [x] Org reassignment: select change opens ConfirmDialog; mutation only fires on explicit Confirm
- [x] Reassignment success/error toasts present
- [x] Audit log ACTION_LABELS: 32 entries covering all current backend actions
- [x] ENTITY_TYPES: 9 types — `Organisation`, `User`, `StockRequest`, `RevokeRequest`, `PurchaseInward`, `LpRequest`, `ClaimRequest`, `StaffAttendance`, `Productivity`
- [x] Organisation creation still creates Org + Admin in single transaction with audit logs
