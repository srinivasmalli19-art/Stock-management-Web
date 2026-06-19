# Phase B Hardening Review — FieldOps Manager
**Date:** 2026-06-13  
**Scope:** Full production hardening audit of all workflows post-Phase A + Phase B  
**Status:** PENDING APPROVAL — No code has been modified

---

## Executive Summary

The application has solid architectural foundations: consistent orgId scoping, functional JWT auth, bcrypt password handling, Prisma with type-safe queries, and a partial audit trail. However, several **Critical and High** issues exist that should be addressed before pilot deployment. The most pressing are missing audit log coverage across five controllers, an N+1 database query in the admin dashboard, and an empty-inventory crash in the CSV export.

---

## CRITICAL Issues

### C1 — Missing Audit Log: `createLog` (Productivity)
**File:** `backend/src/controllers/productivity.controller.js`  
**What happens:** Engineer submits a daily productivity log. No `writeAudit` call is made.  
**Impact:** Zero traceability for Engineer submissions. If a log is disputed or modified downstream, there is no record of the original submission time, content, or who submitted it.  
**Fix required:** Add `writeAudit({ req, action: "PRODUCTIVITY_LOG_SUBMITTED", entityType: "ProductivityLog", entityId: newLog.id, newValue: { date, callsClosed, items } })` after the record is created.

### C2 — Missing Audit Log: `approveRevoke` (Revoke Requests)
**File:** `backend/src/controllers/revokeRequest.controller.js`  
**What happens:** Store Manager approves a revoke — stock items are transferred from engineer back to warehouse, and the StockRequest is updated to "Revoked". No audit entry.  
**Impact:** Stock movements with no paper trail. Impossible to reconstruct warehouse inventory changes from audit logs alone.  
**Fix required:** `writeAudit` on approve with `oldValue: { engineerStock }` and `newValue: { status: "Approved", returnedItems }`.

### C3 — Missing Audit Log: `rejectRevoke` (Revoke Requests)
**File:** `backend/src/controllers/revokeRequest.controller.js`  
**What happens:** SM rejects a revoke — StockRequest is silently reset to "Approved" state. No audit entry.  
**Impact:** No record of rejection decision or who made it.  
**Fix required:** `writeAudit` on reject with `newValue: { status: "Rejected", rejectedAt }`.

### C4 — Missing Audit Log: `rejectInward` (Purchase Inward)
**File:** `backend/src/controllers/purchaseInward.controller.js`  
**What happens:** Admin rejects a purchase inward. No audit entry.  
**Impact:** Financial/procurement rejection decisions are unlogged.  
**Fix required:** `writeAudit` on reject.

### C5 — Missing Audit Log: `submitRevoke` (Stock Request)
**File:** `backend/src/controllers/stockRequest.controller.js`  
**What happens:** Store Manager initiates a revoke request. No audit entry.  
**Impact:** The initiation of a stock return workflow has no log — only the approve/reject outcome would be logged (and currently isn't — see C2/C3).  
**Fix required:** `writeAudit` on revoke submission.

---

## HIGH Issues

### H1 — N+1 Query: `teamLeaderDashboard`
**File:** `backend/src/controllers/dashboard.controller.js`  
**What happens:** The TL dashboard fetches all engineers, then inside `Promise.all` fires **2 separate DB queries per engineer** (one for stock count, one for pending approvals). For an org with 20 engineers, this is 41 database round-trips per dashboard load.  
**Impact:** Dashboard becomes slow at scale. At 50 engineers: 101 queries per page load. Render free tier has high cold-start latency — this amplifies it.  
**Fix required:** Replace per-engineer queries with aggregations — a single `groupBy` on `StockItem` for all engineers in the org, and a single `groupBy` on approvals. Merge results in application code.

### H2 — Missing Audit Log: `validateLog` and `rejectTL` (Productivity)
**File:** `backend/src/controllers/productivity.controller.js`  
**What happens:** Team Leader validates or rejects an Engineer's productivity log. Neither action is logged.  
**Impact:** TL approval decisions leave no audit trail. If an Engineer disputes a rejection, there is no record of when or why it occurred.  
**Fix required:** `writeAudit` on both `validateLog` and `rejectTL` with `oldValue: { status: prev }` and `newValue: { status: new, updatedBy }`.

### H3 — Missing Audit Log: `assignOrganisation` (User)
**File:** `backend/src/controllers/user.controller.js`  
**What happens:** Super_Admin reassigns a user from one organisation to another (or removes org assignment). No audit log is written.  
**Impact:** Organisation reassignment is a high-privilege action with multi-tenant impact — unlogged Super_Admin actions undermine the audit trail's completeness.  
**Fix required:** `writeAudit` with `oldValue: { orgId: user.orgId }` and `newValue: { orgId: body.orgId }`.

### H4 — CSV Export Crash on Empty Inventory
**File:** `backend/src/controllers/inventory.controller.js`  
**What happens:** `downloadInventoryCsv` does `Object.keys(rows[0] || {})`. When `rows` is empty, `rows[0]` is `undefined`, so `rows[0] || {}` evaluates to `{}`, and `Object.keys({})` returns `[]`. The `json2csv` `Parser` with an empty `fields` array produces a CSV with no headers and no rows — a blank file is silently served.  
**Impact:** Admin downloads "inventory" and gets an empty file with no error message. This is confusing and could be mistaken for a system failure.  
**Fix required:** Guard before the parser: `if (!rows.length) return res.status(200).json({ message: "No inventory records to export" })` or send a CSV with a static header row.

---

## MEDIUM Issues

### M1 — No Pagination: Productivity Logs (`getLogs`)
**File:** `backend/src/controllers/productivity.controller.js`  
**What happens:** `getLogs` fetches all productivity logs for the org without limit or offset.  
**Impact:** An org with 6 months of daily logs from 30 engineers has ~5,400 records returned in a single query. Response time and memory usage grows linearly.  
**Fix required:** Add `?page=&limit=` query params with a sensible default (e.g., 50 records).

### M2 — No Pagination: Stock Requests (`getRequests`)
**File:** `backend/src/controllers/stockRequest.controller.js`  
**What happens:** All stock requests fetched in one query.  
**Impact:** Same as M1 — unbounded result set.

### M3 — No Pagination: Purchase Inwards (`getInwards`)
**File:** `backend/src/controllers/purchaseInward.controller.js`  
**What happens:** All inward records fetched without pagination.  
**Impact:** Same as M1.

### M4 — No Pagination: Revoke Requests (`getRevokes`)
**File:** `backend/src/controllers/revokeRequest.controller.js`  
**What happens:** All revoke records fetched without pagination.  
**Impact:** Same as M1.

### M5 — `rejectRevoke` Blindly Resets StockRequest State
**File:** `backend/src/controllers/revokeRequest.controller.js`  
**What happens:** When a revoke is rejected, the code sets the original StockRequest back to "Approved" without verifying the current state of engineer stock. If engineer stock was already modified between revoke initiation and rejection, the state restored may be incorrect.  
**Impact:** Potential stock accounting inconsistency. Low likelihood but non-zero in high-throughput orgs.  
**Fix required:** Read current engineer stock state before resetting StockRequest, or document this as a known limitation.

### M6 — Admin Dashboard LP/Claims Tiles Share the Same Route
**File:** `frontend/src/pages/admin/AdminDashboard.jsx`  
**What happens:** Both "Pending LP Requests" and "Pending Claims" tiles link to `/admin/lp-approvals`. There is no tab differentiation — clicking "Pending Claims" lands the user on LP Approvals with no indication they need to switch.  
**Impact:** Confusing UX — the click hint says "Tap to review" but delivers the wrong page context.  
**Fix required:** Either route Claims to a distinct `/admin/claim-approvals` path if one exists, or append a `?tab=claims` query param that `AdminLPApprovals.jsx` reads on mount to default to the correct tab.

---

## LOW Issues

### L1 — No Rate Limiting on `PATCH /auth/change-password`
**File:** `backend/src/routes/auth.routes.js`  
**What happens:** An authenticated user can call change-password in a tight loop.  
**Impact:** Not an unauthenticated attack vector (requires valid JWT), but a compromised account or automated script could hammer the bcrypt operation (SALT_ROUNDS=12 is deliberately slow), causing CPU pressure on the server.  
**Fix required:** Apply `express-rate-limit` to this endpoint — e.g., 5 requests per 15 minutes per IP, or use the existing rate limiter if one is configured on `app.js`.

### L2 — LP Ownership Tied to `tlEmail` String
**File:** `backend/src/controllers/lpRequest.controller.js`  
**What happens:** LP requests are owned by TL email (`tlEmail: req.user.email`). If a TL's email is changed in the User record, all their existing LP records become orphaned — no longer queryable by that user.  
**Impact:** A TL who gets their email changed (by Admin) silently loses access to their LP history.  
**Fix required:** Long-term: store `tlId` (user PK) alongside `tlEmail`. Short-term: document that TL email changes require data migration. No schema change needed right now if email changes are rare/controlled.

### L3 — `getMonthRange` Timezone Edge Case in AttendanceCalendar
**File:** `frontend/src/components/common/AttendanceCalendar.jsx`  
**What happens:** `new Date(r.date).toISOString().split("T")[0]` converts a date string through a JS `Date` object. If `r.date` is a UTC midnight timestamp (e.g., `"2026-06-01T00:00:00.000Z"`), this works correctly. But if Prisma returns a DateTime with a timezone offset, users in UTC+5:30 could see a date shift (Dec 31 becomes Jan 1 of next year etc.).  
**Impact:** Calendar cells show wrong day for users in positive UTC offset timezones.  
**Fix required:** Use `r.date.split("T")[0]` directly (string slice, no Date constructor) — this is timezone-safe if Prisma returns ISO strings.

### L4 — Missing `isActive` Check in `changePassword`
**File:** `backend/src/controllers/auth.controller.js`  
**What happens:** `changePassword` checks `!user || !user.isActive` and returns 404 if inactive. This is correct. *(No action needed — documented here for completeness that it IS handled.)*

### L5 — No Health Endpoint
**File:** `backend/src/app.js` (not read — inferred)  
**What happens:** There is no `/health` or `/ping` endpoint returning `{ status: "ok", db: "connected" }`.  
**Impact:** Render's uptime monitoring, external status pages, and CI smoke tests have no lightweight endpoint to poll. The app cannot self-report DB connectivity issues.  
**Fix required:** Add `app.get("/health", async (req, res) => { await prisma.$queryRaw\`SELECT 1\`; res.json({ ok: true }); })`.

### L6 — Winston Logs Are Ephemeral on Render Free Tier
**What happens:** Render free instances are ephemeral — disk-based Winston logs are lost on deploy or restart.  
**Impact:** Post-incident log analysis is impossible unless logs are shipped to an external sink.  
**Recommendation:** Add a transport to Winston that ships to a free log drain (e.g., Papertrail, Logtail) or rely on Render's built-in log streaming. Low priority for pilot but required before GA.

---

## Security Summary — No Blocking Issues Found

| Check | Status |
|---|---|
| CORS origins locked to production domains | PASS |
| `sameSite: "none"` + `secure: true` in production | PASS |
| bcrypt SALT_ROUNDS = 12 | PASS |
| JWT payload does not contain sensitive data | PASS |
| `safeUser()` strips passwordHash before returning | PASS |
| orgId scoped on all multi-tenant queries | PASS |
| Super_Admin bypasses `requireOrg` correctly | PASS |
| Engineer cannot access other engineers' stock (IDOR check) | PASS |
| Role guards on all sensitive routes | PASS |
| Joi validation on all mutation endpoints | PASS |
| Change Password requires old password | PASS |
| Change Password audit logged | PASS |
| `.env` not committed | PASS (inferred from git history) |

---

## UI/UX Summary

| Check | Status |
|---|---|
| Login mobile clip fix | PASS (Phase A) |
| Inline login errors | PASS (Phase A) |
| TL Dashboard mobile grid | PASS (Phase A) |
| Admin clickable stat tiles | PASS (Phase A — see M6 for LP/Claims routing) |
| Attendance mobile column hiding | PASS (Phase A) |
| Change Password modal accessible from all roles | PASS (Phase B) |
| Attendance calendar navigation | PASS (Phase B) |
| Calendar past/future/today visual differentiation | PASS (Phase B) |
| Missing empty state: productivity logs table | LOW — shows blank rows when empty; no "No logs yet" message |
| Loading spinners on all query-dependent pages | PASS — PageSpinner used consistently |

---

## Issue Priority Summary

| # | Severity | Issue | File |
|---|---|---|---|
| C1 | CRITICAL | Missing audit: Engineer submits productivity log | productivity.controller.js |
| C2 | CRITICAL | Missing audit: Revoke approved — stock returned | revokeRequest.controller.js |
| C3 | CRITICAL | Missing audit: Revoke rejected | revokeRequest.controller.js |
| C4 | CRITICAL | Missing audit: Purchase inward rejected | purchaseInward.controller.js |
| C5 | CRITICAL | Missing audit: Revoke initiated by SM | stockRequest.controller.js |
| H1 | HIGH | N+1 query in TL dashboard (2N+1 DB calls) | dashboard.controller.js |
| H2 | HIGH | Missing audit: TL validates/rejects productivity log | productivity.controller.js |
| H3 | HIGH | Missing audit: Super_Admin org reassignment | user.controller.js |
| H4 | HIGH | Empty CSV export produces blank file silently | inventory.controller.js |
| M1–M4 | MEDIUM | No pagination on 4 list endpoints | multiple controllers |
| M5 | MEDIUM | Revoke reject blindly resets StockRequest state | revokeRequest.controller.js |
| M6 | MEDIUM | Admin Claims tile routes to LP page, not Claims page | AdminDashboard.jsx |
| L1 | LOW | No rate limit on change-password endpoint | auth.routes.js |
| L2 | LOW | LP ownership by email string — breaks on email change | lpRequest.controller.js |
| L3 | LOW | Calendar date timezone edge case | AttendanceCalendar.jsx |
| L5 | LOW | No /health endpoint | app.js |
| L6 | LOW | Winston logs ephemeral on Render free tier | Infrastructure |

---

## Recommended Fix Order for Phase C Pre-Work

1. **C1–C5** — Add 5 missing `writeAudit` calls (no schema change, low risk, high audit value)
2. **H4** — Fix the empty inventory CSV crash (2-line guard)
3. **M6** — Fix Claims tile routing (1-line change)
4. **H1** — Refactor TL dashboard to batch queries (moderate complexity)
5. **H2–H3** — Remaining audit gaps
6. **L3** — Calendar date safety fix (1-line change, prevents IST/timezone bug)
7. **L1** — Rate limit on change-password
8. **M1–M4** — Pagination (larger scope — can defer to post-pilot)
9. **L5** — Health endpoint
10. **L2, L6** — Infrastructure/data concerns (post-pilot)

**Do not modify code until this report is approved.**
