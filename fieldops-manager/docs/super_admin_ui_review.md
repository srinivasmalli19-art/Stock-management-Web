# Super Admin UI Review

> Status: Review only — do NOT implement findings from this document yet.
> Scope: All four Super Admin pages reviewed post-Phase C2.

---

## SuperAdminDashboard.jsx

| # | Issue | Severity | Suggested Fix | Effort |
|---|-------|----------|---------------|--------|
| 1 | `StatTile` uses hard-coded Tailwind colour classes (`bg-blue-50 text-blue-700`) rather than CSS variable classes, diverging from the rest of the design system | Low | Replace with the `StatTile` from `SuperAdminMonitoring.jsx` which uses `bg-bg` / `text-accent` | 30 min |
| 2 | The "Organisations" table at the bottom duplicates information visible on the Orgs page with no navigation affordance — rows are not clickable | Low | Make rows navigate to `/superadmin/organisations` or remove the table in favour of a "View all →" link | 20 min |
| 3 | Stat tiles use the same `Users` icon for both "Total Users" and "Unassigned Users" — hard to scan visually | Low | Use `UserX` or `AlertCircle` icon for Unassigned tile | 10 min |
| 4 | No error boundary — if the `sa-users` query fails, the whole page crashes silently | Medium | Add `isError` guard and show an inline error card | 20 min |

---

## SuperAdminOrgs.jsx

| # | Issue | Severity | Suggested Fix | Effort |
|---|-------|----------|---------------|--------|
| 5 | ~~Form created the organisation without an admin user, requiring a separate manual step in Users page~~ | ~~Critical~~ | **Fixed in this sprint** | — |
| 6 | ~~`siteCode` Joi schema used `alphanum()` which rejects hyphens, but the frontend accepted them~~ | ~~High~~ | **Fixed in this sprint** | — |
| 7 | No way to edit an organisation's name after creation (the `editId` state was declared but never used in a form) | Medium | Add inline edit modal for org name | 45 min |
| 8 | Enable/Disable action provides no feedback toast on success — updateMut `onSuccess` is silent | Low | Add `toast.success(...)` in `updateMut.onSuccess` | 5 min |
| 9 | The "New Org" button toggles the form but form state is not reset on open — a failed attempt leaves stale field values | Low | Reset form to `EMPTY` when toggling open — **partially addressed in this sprint** (reset on cancel; on open via `setForm(EMPTY)`) | Done |

---

## SuperAdminUsers.jsx

| # | Issue | Severity | Suggested Fix | Effort |
|---|-------|----------|---------------|--------|
| 10 | **Unassigned filter is broken**: filter compares `u.orgId === "__unassigned__"` but `orgId` is `null` for unassigned users — the filter never matches | High | Change filter logic to `u.orgId == null` when `filterOrg === "__unassigned__"` | 10 min |
| 11 | Org reassignment select fires `assignMut` immediately on change with no confirmation — accidental reassignments require support intervention to undo | Medium | Wrap in a `ConfirmDialog` before firing the mutation, or at minimum add an explicit "Apply" button per row | 1 h |
| 12 | Filter bar uses `flex gap-2` — on narrow screens the search input and org select overflow horizontally | Medium | Change to `flex flex-col sm:flex-row gap-2` | 5 min |
| 13 | No feedback toast on successful or failed org reassignment — `assignMut.onSuccess` only invalidates queries | Low | Add `toast.success("Organisation updated")` in `onSuccess` and `toast.error(...)` in `onError` | 10 min |
| 14 | `assignMut.isPending` disables only the select that triggered the mutation; other rows remain interactive while a request is in flight | Low | Disable all selects while `assignMut.isPending` | 5 min |
| 15 | `api.get("/users", { params: { limit: 200 } })` hard-codes 200 as the page ceiling — organisations with more users will be silently truncated | Low | Either implement proper pagination on this page or increase limit to a safe ceiling and add a warning | 1.5 h |
| 16 | Table has no `overflow-x-auto` wrapper — the `w-40` reassign select can push columns off-screen on tablets | Low | Wrap table in `<div className="overflow-x-auto tbl">` (already done on other pages) | 5 min |

---

## SuperAdminAuditLogs.jsx

| # | Issue | Severity | Suggested Fix | Effort |
|---|-------|----------|---------------|--------|
| 17 | `ACTION_LABELS` map is missing 8 actions added during the hardening sprint: `PRODUCTIVITY_SUBMITTED`, `PRODUCTIVITY_VALIDATED`, `PRODUCTIVITY_REJECTED`, `REVOKE_INITIATED`, `REVOKE_APPROVED`, `REVOKE_REJECTED`, `USER_ORG_REASSIGNED`, `ORGANISATION_CREATED` — these render as raw enum strings in the table | High | Add the missing entries to `ACTION_LABELS`; mirror the same additions to `SuperAdminMonitoring.jsx` | 15 min |
| 18 | `ENTITY_TYPES` filter dropdown is missing three entity types: `Productivity`, `RevokeRequest`, `Organisation` — these cannot be filtered by entity type | High | Add the missing types to the `ENTITY_TYPES` array | 5 min |
| 19 | Export downloads only the current page (50 rows) — for compliance/audit use cases, operators expect a full export | Medium | Add "Export All" button that passes current filter params without pagination, or offer a "select all pages" checkbox | 2 h |
| 20 | No free-text user name search — `role` and `orgId` filters exist but there is no way to search for all actions by a specific person | Low | Add a `userName` filter input that filters client-side against `log.userName` (data is already in the response) | 20 min |
| 21 | The `actionBadgeClass` function does not account for `REVOKE_INITIATED` or `ORGANISATION_CREATED` — both fall through to the grey default rather than the blue "created/submitted" bucket | Low | Add `action.includes("INITIATED")` and `action.includes("ORGANISATION_")` to the blue clause | 5 min |
| 22 | Date range filters have no quick-select presets (Today, This Week, This Month) — operators must set from/to manually for every session | Low | Add a `<select>` preset that auto-fills `from`/`to` on change | 45 min |

---

## Cross-Cutting Notes

- The `ACTION_LABELS` duplication across `SuperAdminAuditLogs.jsx` and `SuperAdminMonitoring.jsx` creates a maintenance hazard — both maps will drift whenever new audit actions are added. Consider extracting to `src/constants/auditActions.js`.
- Super Admin pages do not share a common `PageHeader` component — each page manually composes `<h1>` + `<p>` with slightly different markup. Extracting a `PageHeader` component would unify this.
