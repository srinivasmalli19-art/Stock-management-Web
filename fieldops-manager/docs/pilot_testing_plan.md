# LogiTask — Pilot Testing Plan

**Status:** Feature freeze in effect. This document is analysis/documentation only — no application code was modified to produce it.
**Scope:** Workflow-by-workflow test cases for pilot testing, derived from a direct read of `backend/src/controllers/*.js`, `backend/src/routes/*.js`, and `backend/prisma/schema.prisma`.
**Risk levels:** Critical / High / Medium / Low — defined in [pre_launch_risk_assessment.md](pre_launch_risk_assessment.md).

---

## How to read this document

Each workflow lists test cases as:

`TC-<workflow>-<n>` | **Action** | **Expected Result** | **Risk Level**

Risk level reflects the consequence of the test case *failing* in pilot (data corruption, financial impact, security exposure), not the likelihood of failure.

---

## 1. Authentication

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-AUTH-1 | Login with valid email + password | 200, access token returned, refresh token cookie set (`httpOnly`, `secure` in prod, `sameSite=none` in prod) | Critical |
| TC-AUTH-2 | Login with wrong password | 401, no token issued | Critical |
| TC-AUTH-3 | Login as a deactivated user (`isActive=false`) | 401 — login rejected even with correct password | Critical |
| TC-AUTH-4 | Refresh token flow after access token expiry | New access token issued silently; user stays logged in | High |
| TC-AUTH-5 | Refresh using a revoked refresh token (post-logout) | 401, forced re-login | High |
| TC-AUTH-6 | Refresh using an expired refresh token | 401, forced re-login | High |
| TC-AUTH-7 | Logout | Refresh token marked `isRevoked=true`; cookie cleared; subsequent refresh fails | High |
| TC-AUTH-8 | Change password with correct old password | 200; password updated; audit log `PASSWORD_CHANGED`; notification sent | Medium |
| TC-AUTH-9 | Change password with incorrect old password | 401/400, no change applied | Medium |
| TC-AUTH-10 | Change password to the **same** password as before | Currently **succeeds** (no check exists) — confirm this is acceptable for pilot or flag as a gap | Low |
| TC-AUTH-11 | Repeated failed logins (brute force simulation, 10+ attempts) | No rate limiting exists — request will not be blocked. Confirm this is acceptable exposure for a closed pilot. | High |
| TC-AUTH-12 | Cross-tab / cross-device login as same user | Both sessions remain valid simultaneously (no single-session enforcement) | Low |

---

## 2. Organisation Management (Super_Admin)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-ORG-1 | Create organisation with unique site code + unique admin email | 201; Organisation + Admin user created in one transaction; 2 audit entries | Critical |
| TC-ORG-2 | Create organisation with a site code that already exists | 409 Conflict, no partial record created | High |
| TC-ORG-3 | Create organisation with an admin email that already exists (any org) | 409 Conflict | High |
| TC-ORG-4 | Create organisation with site code in mixed case (e.g. `pilot-01` vs `PILOT-01`) | Code uppercases before storage — verify no duplicate slips through with different casing | Medium |
| TC-ORG-5 | Deactivate an organisation (`isActive=false`) | Org marked inactive; **no audit log is written for this action** — confirm acceptable | Medium |
| TC-ORG-6 | Attempt to access `/organisations` as non-Super_Admin | 403 Forbidden (route-level `authorize("Super_Admin")` middleware) | Critical |
| TC-ORG-7 | Users under a deactivated organisation attempt login | Confirm whether login is blocked — behavior depends on `user.isActive`, not `org.isActive`; this is a likely gap (see risk assessment) | High |

---

## 3. User Registry

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-USR-1 | Admin creates a user (Engineer/TL/SM/Admin) in own org | 201; user scoped to Admin's `orgId`; audit + notification | Critical |
| TC-USR-2 | Admin attempts to create a user with an email that already exists | 409 Conflict | High |
| TC-USR-3 | Admin attempts to view/edit a user belonging to a **different** org | 404 (org isolation masks existence) | Critical |
| TC-USR-4 | Admin changes a user's role (e.g. Engineer → Team_Leader) | Role updated; **no restriction on which roles an Admin may assign** — verify an Admin cannot escalate a user to `Super_Admin` via this endpoint (route Joi schema restricts to `Engineer/Team_Leader/Store_Manager/Admin`, confirm enforced) | Critical |
| TC-USR-5 | Reset another user's password | 200; password updated; **no notification sent to the affected user** — confirm acceptable for pilot | Medium |
| TC-USR-6 | Deactivate a user (`isActive=false`) | User immediately blocked from login; existing access tokens still technically valid until expiry — confirm acceptable token TTL | High |
| TC-USR-7 | Super_Admin reassigns a user to a different/no organisation | 200; org reassignment applied; **active sessions for that user are not invalidated** — user keeps old org context until token expiry/refresh | High |
| TC-USR-8 | Create an Engineer user when that email previously existed as a different role | New user created; verify `EngineerStock` is cleared on Engineer creation as observed in code — confirm this doesn't silently wipe legitimate stock if reused/edited | Medium |
| TC-USR-9 | Non-Admin/Super_Admin attempts any user management endpoint | 403 Forbidden (route middleware) | Critical |

---

## 4. Attendance (Engineer — auto-tracked)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-ATT-1 | View consolidated attendance register for current month as Admin | Accurate Present/Absent counts per engineer for the org | High |
| TC-ATT-2 | Download attendance CSV for current month | CSV generated; future dates (today → month end) shown as Absent by default — confirm this doesn't mislead reviewers mid-month | Medium |
| TC-ATT-3 | View attendance summary on the 1st of the month (1 working day elapsed) | `workingDays` = 1, not full month — confirm dashboard % calculations read correctly on early days | Medium |
| TC-ATT-4 | Attendance auto-marked "Present" when a Productivity Log is Admin-approved | `Attendance` record created/updated via upsert, linked to the log | High |

---

## 5. Productivity (Engineer logs → TL validates → Admin approves)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-PROD-1 | Engineer submits a productivity log for today with calls + accessory items | 201; one log created; status `Pending`; TLs notified | Critical |
| TC-PROD-2 | Engineer submits a second log for the **same date** | 409 — unique constraint `(engineerId, date)` blocks duplicate | High |
| TC-PROD-3 | Engineer submits a log with a **future date** | Currently **succeeds** — no validation blocks this | Medium |
| TC-PROD-4 | Engineer submits a log with **zero items and zero calls** | Currently **succeeds** — confirm whether an empty log should be permitted | Low |
| TC-PROD-5 | TL validates a Pending log | Status → `Validated`; engineer notified | Critical |
| TC-PROD-6 | TL rejects a Pending log with a note | Status → `Rejected`; engineer notified with reason | Critical |
| TC-PROD-7 | Engineer resubmits a Rejected log with corrected data | Old items deleted, new items created, status reset to `Pending` | High |
| TC-PROD-8 | Admin approves a Validated log, assigning per-item incentive | Status → `Approved`; attendance marked Present; **stock deducted from EngineerStock per item qty**; engineer notified with total incentive | Critical |
| TC-PROD-9 | Admin approves a log where engineer's van stock for an item is **less than the logged qty** | Stock silently floors to 0 instead of blocking approval (`Math.max(0, qty - item.qty)`) — **verify with real data whether this under/overshoot is acceptable or must block approval** | High |
| TC-PROD-10 | Admin rejects a Validated log | Status → `Rejected`; no stock/attendance side effects applied | Critical |
| TC-PROD-11 | Engineer attempts to validate/approve their own log | 403 — role-gated to TL/Admin | Critical |
| TC-PROD-12 | Engineer attempts to view another engineer's logs | Blocked — Engineer queries are forced to `engineerId = self` | High |
| TC-PROD-13 | Two Admins click Approve on the same Validated log within the same second | First succeeds; second should fail on the status guard (`status !== "Validated"`) — verify no double-deduction occurs under real concurrency | High |

---

## 6. Approval Center (merged Productivity + Attendance approvals — Admin)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-APC-1 | Open Approval Center, switch between Productivity / Attendance tabs | Correct queue renders per tab; pending counts in tab labels match badge count | Medium |
| TC-APC-2 | Pending badge count matches actual count of open items across both tabs | Header badge = sum of both queues; updates after an approval action | Medium |
| TC-APC-3 | Approve/reject from within the merged view | Behaves identically to the original standalone screens (no regressions from the merge) | High |

---

## 7. Purchase Inward (Store Manager submits → Admin approves)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-PUR-1 | Store Manager creates a purchase inward entry for an existing SKU | 201; status `Pending` | Critical |
| TC-PUR-2 | Create entry referencing a SKU from a **different org** | 404 — SKU org isolation enforced | Critical |
| TC-PUR-3 | Create entry with `qty = 0` or negative | Currently **succeeds** — no positivity check | High |
| TC-PUR-4 | Create entry with the same vendor + invoice number twice | Currently **succeeds** — no duplicate-invoice guard, risk of double-counting the same physical delivery | High |
| TC-PUR-5 | Admin approves a Pending entry | Status → `Approved`; `MainInventory.qty += entry.qty`; unit price updated to latest; **no notification sent to the Store Manager who submitted it** | Critical |
| TC-PUR-6 | Admin rejects a Pending entry | Status → `Rejected`; no inventory change; **no notification sent to submitter** — confirm acceptable | Medium |
| TC-PUR-7 | Approve an entry that is not Pending (already Approved/Rejected) | 400 — blocked by status guard | High |

---

## 8. Revoke Requests (Admin-initiated reversal of an approved stock allocation)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-REV-1 | Store Manager/Admin submits a revoke against an Approved stock request | StockRequest → `Revoke_Pending`; RevokeRequest created | High |
| TC-REV-2 | Attempt to submit a second revoke against the same stock request | 409 — one revoke per request enforced | Medium |
| TC-REV-3 | Admin approves the revoke | `EngineerStock -= qty`, `MainInventory += qty`, StockRequest → `Revoked`; engineer notified | Critical |
| TC-REV-4 | Admin approves a revoke where the engineer's current stock is **less than the revoke qty** | Stock silently floors to 0 instead of blocking (`Math.max(0, qty - rv.qty)`) — verify with real numbers whether this masks a discrepancy that should be investigated instead | High |
| TC-REV-5 | Admin rejects the revoke | RevokeRequest → `Rejected`; StockRequest restored to `Approved`; engineer notified | High |

---

## 9. LP Requests (Team Leader raises → Admin approves)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-LP-1 | TL creates an LP request with spare cost + service cost | 201; `totalCost` = sum; unique `requestId` generated (`LP-YYYYMMDD-XXXX`); status `LP_PENDING_ADMIN_APPROVAL`; Admins notified | Critical |
| TC-LP-2 | Create an LP request with negative or non-numeric costs | Costs are coerced via `Number(x) || 0` — a negative number **passes through unmodified**; verify whether negative LP costs are valid in business terms | Medium |
| TC-LP-3 | Admin approves the LP request | Status → `CLAIM_PENDING`, unlocking the claim step; TL notified | Critical |
| TC-LP-4 | Admin rejects the LP request | Status → `LP_REJECTED` (terminal); TL notified | Critical |
| TC-LP-5 | TL views the LP queue | Only sees LPs they personally raised (`tlEmail` match) | High |
| TC-LP-6 | Generate two LP requests in the same second (requestId collision check) | `LP-YYYYMMDD-XXXX` uses a 4-digit random suffix — there's a theoretical 1-in-10,000 collision chance per day; confirm `requestId` unique constraint causes a clean 409 rather than a crash if it ever collides | Low |

---

## 10. Claims (Team Leader → Store Manager validates → Admin approves)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-CLM-1 | TL creates a claim against an LP in `CLAIM_PENDING` status | 201; status `CLAIM_VALIDATION_PENDING`; Store Managers notified | Critical |
| TC-CLM-2 | Create a claim with amount exceeding the LP's `totalCost` | 400 — blocked by explicit ceiling check | High |
| TC-CLM-3 | Create a second claim against the same LP | 400 — one claim per LP enforced (`lp.claim !== null`) | High |
| TC-CLM-4 | Create a claim with amount `<= 0` or non-numeric | 400 — blocked by `isNaN`/`<=0` check | Medium |
| TC-CLM-5 | Store Manager validates a claim | Status → `CLAIM_ADMIN_APPROVAL_PENDING`; Admins + TL notified | Critical |
| TC-CLM-6 | Store Manager rejects a claim | Status → `CLAIM_REJECTED` (terminal); TL notified | Critical |
| TC-CLM-7 | Admin approves a validated claim | Status → `CLAIM_APPROVED` (terminal); TL notified | Critical |
| TC-CLM-8 | Admin rejects a validated claim | Status → `CLAIM_REJECTED`; TL notified | Critical |
| TC-CLM-9 | TL attempts to create a claim for an LP they did not raise | 403 — ownership check on `lp.tlEmail` | Critical |

---

## 11. SKU Registry (Store Manager creates → Admin edits/deletes)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-SKU-1 | Store Manager registers a new SKU ID + name | 201; `Sku` + zero-qty `MainInventory` created in one transaction; Admins notified; audit action `SKU_CREATED_BY_STORE_MANAGER` | Critical |
| TC-SKU-2 | Register a SKU ID that already exists **in any organisation, not just your own** | 409 — `Sku.id` is a global primary key, not scoped per-org. **Two different organisations cannot both use SKU ID "PART-001."** This must be explicitly tested across two pilot orgs if more than one is running concurrently. | Critical |
| TC-SKU-3 | Admin edits a SKU's name or low-stock alert threshold | 200; updated — **no audit log entry is written for this update** (confirmed gap in code) | Medium |
| TC-SKU-4 | Set `lowStockAlert` above the SKU's current on-hand quantity | Currently **succeeds** — triggers immediate "low stock" flag with no warning to the editor | Low |
| TC-SKU-5 | Engineer or Team Leader attempts to create/edit a SKU | 403 — role-gated to Store_Manager/Admin/Super_Admin | High |

---

## 12. Stock Allocation (Engineer requests → Store Manager approves)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-STK-1 | Engineer requests qty of an existing SKU | 201; status `Pending`; Store Managers notified | Critical |
| TC-STK-2 | Request a qty of `0` or negative | Currently **succeeds** — no positivity check | High |
| TC-STK-3 | Store Manager approves a request where `MainInventory.qty < requested qty` | 400 — blocked; correctly validated before allocation | Critical |
| TC-STK-4 | Store Manager approves a request with sufficient inventory | `MainInventory -= qty`, `EngineerStock += qty` (created if first allocation), status → `Approved`; engineer notified | Critical |
| TC-STK-5 | Store Manager rejects a Pending request | Status → `Rejected`; engineer notified | Critical |
| TC-STK-6 | Engineer resubmits a Rejected request (optionally changing SKU/qty) | Status reset to `Pending`; re-enters Store Manager queue | High |
| TC-STK-7 | Engineer requests the same SKU twice while a request is already Pending | Currently **succeeds** — no duplicate-open-request guard; confirm this is intended (engineers may legitimately need to top up) | Low |

---

## 13. Engineer Van Stock (read + return entry point)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-VAN-1 | Engineer views own van stock | Accurate qty per SKU currently allocated | High |
| TC-VAN-2 | Engineer attempts to view another engineer's van stock via API manipulation | Blocked — `getMyStock` is hard-scoped to `req.user.id`; `getEngineerStock` (Admin route) verifies org match before exposing data (IDOR check present) | Critical |
| TC-VAN-3 | Export van stock to CSV | CSV downloads with correct SKU/qty rows | Low |

---

## 14. Return Stock (Engineer returns to warehouse → Store Manager approves)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-RTN-1 | Engineer submits a return for a SKU they currently hold, qty ≤ on-hand | 201; status `Pending`; Store Managers notified | Critical |
| TC-RTN-2 | Submit a return for a SKU the engineer does **not** hold (qty=0 or no record) | 400 — blocked by stock-availability check | High |
| TC-RTN-3 | Submit a return qty **greater than** on-hand qty | 400 — blocked | High |
| TC-RTN-4 | Store Manager approves the return | `EngineerStock -= qty`, `MainInventory += qty`, status → `Approved`; engineer notified | Critical |
| TC-RTN-5 | Store Manager rejects the return (with optional note) | Status → `Rejected`; engineer notified with reason | Critical |
| TC-RTN-6 | Engineer resubmits a Rejected return | Stock re-validated against **current** on-hand qty (not the qty at original submission time); status reset to `Pending` | Medium |
| TC-RTN-7 | Filter return requests by status tab (Pending/Approved/Rejected/All) | Correct subset displayed; pending count badge accurate | Low |

---

## 15. Dashboards (all 5 roles)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-DSH-1 | Engineer Dashboard reflects MTD calls/revenue/incentive/days present | Matches sum of this engineer's **Approved** logs for the current month only | High |
| TC-DSH-2 | TL Dashboard team totals match sum of all engineers under that TL | Verify TL's team scope is correctly resolved (org + reporting line) | High |
| TC-DSH-3 | Store Manager Dashboard pending counts match actual open Stock/Purchase/Claim queues | No drift between dashboard counts and queue screens | High |
| TC-DSH-4 | Admin Dashboard pending action tiles link to the correct (merged) Approval Center route | Verify links resolve to `/admin/approval-center`, not legacy redirect routes | Medium |
| TC-DSH-5 | Super Admin Dashboard org/user counts match Organisation + User Registry totals | No drift | Medium |
| TC-DSH-6 | All dashboards reload correctly after a 401 (expired token) mid-session | Token refresh kicks in transparently, or user is redirected to login without a blank/broken screen | High |
| TC-DSH-7 | Dashboard widgets API (`/dashboard/widgets`) under concurrent load from multiple roles | No cross-role data leakage; each role only receives its own pending/today metrics | Critical |

---

## Cross-Workflow Test Cases (multi-tenant + concurrency)

| ID | Test Case | Expected Result | Risk |
|----|-----------|------------------|------|
| TC-XW-1 | Run two pilot organisations simultaneously and create overlapping SKU IDs | **Will fail** — confirmed global SKU ID collision (see TC-SKU-2). Decide before pilot: single-org pilot only, or pre-allocate non-overlapping SKU ID prefixes per org. | Critical |
| TC-XW-2 | Two users click Approve on the same record (productivity/revoke/inward/return/stock request) within the same second | Exactly one succeeds; the other receives a clean "already processed" error, not a server crash or duplicate financial/inventory effect | High |
| TC-XW-3 | Submit any workflow action right as a JWT access token expires | Either the request completes on the still-valid token, or the client retries seamlessly after a silent refresh — no silent data loss from a dropped request | Medium |
| TC-XW-4 | Audit Log / Monitoring screens reflect every state-changing action performed during the pilot | Spot-check 10 random actions across different workflows against the Audit Log | Medium |
