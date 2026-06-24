# LogiTask — Pre-Launch Risk Assessment

**Status:** Analysis/documentation only. No application code, schema, or configuration was modified to produce this report.
**Method:** Direct read of every backend controller (`backend/src/controllers/*.js`), route files (`backend/src/routes/*.js`), and the Prisma schema (`backend/prisma/schema.prisma`). Each finding below was verified against the actual source, not inferred from naming conventions alone.

**Risk level definitions used throughout:**
- **Critical** — could cause cross-tenant data exposure, financial miscalculation, or a workflow becoming permanently stuck/corrupted
- **High** — could cause incorrect business data (inventory, incentive, attendance) within a single tenant, recoverable with manual intervention
- **Medium** — UX/data-quality gap that doesn't corrupt data but could confuse users or auditors
- **Low** — cosmetic or edge-case gap, acceptable to carry into pilot with awareness

---

## A. Critical Risks

### A1. SKU IDs are globally unique across organisations, not per-org

**Where:** `backend/prisma/schema.prisma` — `model Sku { id String @id ... orgId String ... }`

`id` is the Prisma primary key with no composite uniqueness against `orgId`. Two different pilot organisations cannot both register a SKU with the same ID (e.g. both wanting `"SKU-001"`). The second organisation's create call will hit the existing global record and receive `409 Conflict`.

**Impact:** If the pilot runs more than one organisation concurrently, SKU registration will intermittently fail in a way that looks like a bug to Store Managers, with no indication in the UI that the cause is a cross-org collision.

**Recommendation before multi-org pilot:**
- Short-term (no code change): agree a SKU ID naming convention per org (e.g. org prefix) and communicate it to all pilot Store Managers.
- Longer-term (code change, out of scope for this freeze): change the schema to `@@unique([id, orgId])` with a separate generated primary key — this is a schema migration and must go through proper review, not be rushed in under freeze.

---

### A2. Inventory deduction silently floors at zero instead of rejecting

**Where:**
- `productivity.controller.js` — `approveLog()`, engineer stock deduction on item approval
- `revokeRequest.controller.js` — `approveRevoke()`, engineer stock deduction
- `returnRequest.controller.js` — `approveReturnRequest()`, engineer stock deduction

All three use the pattern `Math.max(0, existingQty - deductedQty)`. If the deducted quantity exceeds what the engineer actually has on record, the result is clamped to `0` rather than the action being rejected.

**Impact:** A real-world discrepancy (engineer's physical stock doesn't match the system's recorded stock) gets silently absorbed instead of surfaced. Inventory numbers can drift from physical reality without anyone being alerted, which is exactly the kind of error a pilot is meant to catch — but currently it would not raise any error or warning.

**Recommendation:** During pilot, manually reconcile physical/system stock counts at the end of each test day (see `pilot_execution_checklist.md` Phase 9). Treat any case where this clamping actually triggers as a pilot finding to escalate, since it means a deduction was approved against insufficient recorded stock.

---

### A3. Organisation deactivation does not appear to block its users from logging in

**Where:** `auth.controller.js` `login()` checks `user.isActive` only. `organisation.controller.js` `updateOrganisation()` can set `Organisation.isActive = false`, but no cross-check against `org.isActive` was found in the login path.

**Impact:** Deactivating a pilot organisation (e.g. to pause a misbehaving tenant) would not actually lock out its users — they could continue logging in and operating normally.

**Recommendation:** Explicitly test TC-ORG-7 in the execution checklist before relying on org deactivation as a control during the pilot. If confirmed, treat "deactivate org" as non-functional for now and use individual user deactivation (`isActive` on `User`) instead, which **is** enforced.

---

## B. High Risks

### B1. No optimistic locking / idempotency guard on approval actions under concurrency

Every approve/reject handler (productivity, purchase inward, revoke, return, stock request, attendance, LP, claims) relies on a single status-guard check (`if (record.status !== "Pending") return 400`) immediately followed by a database write. Under genuinely concurrent requests (two admins clicking Approve within the same request cycle), there is no row-level locking or optimistic version check between the read and the write.

**Impact:** Low probability in a small pilot with few concurrent admins, but if it occurs, the second request's behavior depends on transaction timing rather than a guaranteed clean rejection. Test explicitly (TC-XW-2) rather than assuming it's safe.

### B2. No quantity positivity validation on several creation endpoints

`stockRequest.createRequest`, `returnRequest.createReturnRequest`, `purchaseInward.createInward` — none validate `qty > 0` at the controller level. A request with `qty=0` or a negative number would currently be accepted by the backend (subject to whatever the frontend form's `min` attribute allows, which is a client-side-only constraint and can be bypassed).

**Impact:** Zero or negative quantities flowing into inventory math could produce confusing negative or unchanged stock figures.

**Recommendation:** Treat any pilot user managing to submit a zero/negative quantity as a confirmed finding, not just a theoretical risk — test it deliberately (covered in the testing plan).

### B3. No future-date / backdating guard on productivity logs or staff attendance

`productivity.createLog()` and `staffAttendance.submitAttendance()` accept any `date` value without comparing to "today." An engineer could submit a productivity log for next week, or a Team Leader could submit attendance for a date weeks in the past.

**Impact:** Could distort dashboards (MTD figures) and attendance percentages if exploited, intentionally or by mistake (e.g. wrong date picked in a date input).

### B4. Purchase Inward has no duplicate-invoice protection

`purchaseInward.createInward()` does not check whether the same `vendor` + `invoiceNo` combination has already been entered. The same physical delivery could be recorded twice, double-counting inventory on approval.

### B5. No notification on Purchase Inward approval/rejection to the submitting Store Manager

Unlike most other workflows (productivity, stock requests, returns, revokes, LP, claims — all of which notify the relevant party on every state change), Purchase Inward approve/reject does not appear to send a notification back to the Store Manager who created the entry. They would need to manually check the screen to learn the outcome.

### B6. Session/org reassignment does not invalidate existing tokens

When a Super_Admin reassigns a user to a different organisation (`assignOrganisation`), or an Admin deactivates a user, any already-issued access token for that user remains valid until its natural expiry, and any refresh token remains valid until logout or explicit revocation. The user does not see the change take effect until their token cycle naturally refreshes.

**Impact:** During pilot, if a tester is moved between orgs or deactivated mid-session as part of a test, expect a delay before the change is observed — don't mistake this for a bug; budget for token TTL in test timing.

---

## C. Medium Risks

| # | Finding | Where |
|---|---------|-------|
| C1 | `sku.updateSku()` writes no audit log entry — SKU name/threshold edits by Admin are untracked | `sku.controller.js` |
| C2 | `organisation.updateOrganisation()` writes no audit log entry | `organisation.controller.js` |
| C3 | LP request costs are coerced with `Number(x) || 0` — a negative number passes through unchanged rather than being rejected | `lpRequest.controller.js` |
| C4 | Attendance CSV export assumes any future date with no record is "Absent," which could be misread if downloaded mid-month | `attendance.controller.js` |
| C5 | `resetPassword` (Admin resetting another user's password) sends no notification to the affected user, while the user-initiated `changePassword` does | `user.controller.js` |
| C6 | `changePassword` does not block setting the new password identical to the old one | `auth.controller.js` |
| C7 | Several status fields (`ReturnRequest.status`, `StaffAttendance.submissionStatus`, `LpRequest.status`, `ClaimRequest.status`) are plain strings rather than Prisma enums, so there is no database-level guarantee against typos/invalid values being written — current code paths only set known-good values, but this is worth flagging for future hardening, not urgent for pilot. | `schema.prisma` |

---

## D. Low Risks (acceptable to carry into pilot, listed for completeness)

- No rate limiting on login — acceptable for a closed pilot with trusted test users, **not** acceptable for public production launch without revisiting
- No duplicate-request guard preventing an engineer from opening two simultaneous stock requests for the same SKU (may be intentional — engineers can legitimately need a top-up)
- `lowStockAlert` can be set above current on-hand quantity with no warning, immediately triggering a "low stock" flag
- Multiple simultaneous logins for the same user across devices are both kept valid (no single-session enforcement)
- LP request ID generation uses a 4-digit random suffix with a theoretical same-day collision chance; protected by a unique constraint so a collision would produce a clean error, not corrupt data

---

## E. What Was Verified as Sound (no action needed)

To keep this report balanced, the following protections were directly confirmed in code and do **not** need re-litigating during pilot:

- Org isolation is consistently enforced via `req.user.orgId` scoping on every multi-tenant read/write path reviewed (Users, SKUs, Stock Requests, Productivity, Purchase Inward, Revoke, Return, LP, Claims)
- IDOR protection on Engineer stock viewing — Admin-facing `getEngineerStock` explicitly checks the target engineer belongs to the caller's org before returning data
- Route-level role authorization (`authorize("Admin", "Super_Admin")`, etc.) is applied consistently across `backend/src/routes/*.js` — the earlier draft concern that authorization was "assumed but unenforced" was checked directly against `organisation.routes.js` and `user.routes.js` and found to be properly wired via Express middleware, not just assumed
- Stock allocation correctly validates available `MainInventory` quantity **before** approving a Store Manager allocation (this is the one inventory deduction path that does reject rather than clamp — contrast with A2)
- Claims workflow has solid guardrails: amount ceiling against LP total cost, one-claim-per-LP enforcement, and ownership checks on claim creation
- Password hashing, refresh-token revocation/expiry checks, and active-user gating are all present and correctly ordered in the auth flow
- Engineer-facing endpoints are consistently self-scoped (`engineerId = req.user.id`) preventing one engineer from viewing or acting on another's records

---

## F. Recommended Go/No-Go Gate for Pilot Start

The application **can proceed to pilot** with the following conditions:

1. **Single-organisation pilot only**, unless a SKU naming convention is agreed in writing for multi-org testing (A1)
2. Manual physical-vs-system stock reconciliation performed at the end of each pilot day (A2)
3. Org deactivation is not used as a live control mechanism during pilot — use per-user deactivation instead, and confirm A3 with a direct test before depending on it (TC-ORG-7)
4. All Critical and High findings in this document are read and acknowledged by the pilot owner before user testing begins
5. None of the findings in this report require a code change to safely begin a **controlled, single-org pilot** with trusted internal users — they represent monitoring/process mitigations, not blockers, with the exception of the multi-org SKU collision (A1), which is a hard blocker for multi-org concurrent testing specifically.
