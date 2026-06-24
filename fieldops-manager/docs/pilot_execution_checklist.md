# LogiTask — Pilot Execution Checklist

Companion to [pilot_testing_plan.md](pilot_testing_plan.md) (test cases) and [pre_launch_risk_assessment.md](pre_launch_risk_assessment.md) (risk detail). Use this as the literal day-of-pilot run sheet. Check items off in order — sections build on each other (you cannot test Productivity approvals before Stock Allocation, etc.).

---

## Phase 0 — Pre-Pilot Setup (before any test user touches the app)

- [ ] Confirm feature freeze is communicated to all stakeholders — no further feature merges until pilot sign-off
- [ ] Confirm target environment (staging vs production-mirrored) and that it is **not** the live production database
- [ ] Confirm `DATABASE_URL`, JWT secrets, and any `.env` values used for pilot are pilot-specific, not reused production secrets
- [ ] Confirm CORS `PRODUCTION_ORIGINS` includes only the actual pilot domain(s) — no wildcard origins
- [ ] Decide and document: **single organisation pilot, or multi-org pilot?** (Critical — see TC-XW-1 / TC-SKU-2: SKU IDs are globally unique across orgs, not per-org. Multi-org pilot requires a pre-agreed SKU ID naming convention per org, e.g. org prefix, to avoid collisions.)
- [ ] Create the pilot Organisation(s) via Super_Admin (`TC-ORG-1`)
- [ ] Create one user per role needed for the pilot: Engineer, Team_Leader, Store_Manager, Admin (`TC-USR-1`)
- [ ] Distribute credentials out-of-band (not via this app — no "forgot password" self-service flow was identified in the controllers; password resets are Admin-driven)
- [ ] Confirm each pilot user can log in once before pilot day (`TC-AUTH-1`)
- [ ] Seed at least 3–5 SKUs via Store Manager SKU Registry (`TC-SKU-1`)
- [ ] Record starting `MainInventory` qty for each seeded SKU (for reconciliation at pilot end — see Phase 6)

---

## Phase 1 — Authentication & Access Control

- [ ] TC-AUTH-1 — Valid login for each role
- [ ] TC-AUTH-2 — Invalid password rejected
- [ ] TC-AUTH-3 — Deactivated user cannot log in
- [ ] TC-AUTH-4 — Session survives access-token expiry (leave a tab open past token TTL, confirm silent refresh)
- [ ] TC-AUTH-7 — Logout invalidates the session (confirm refresh fails after logout)
- [ ] TC-AUTH-8 — Change password (self-service) works end to end
- [ ] TC-ORG-6 — Non-Super_Admin blocked from Organisation endpoints
- [ ] TC-USR-9 — Non-Admin blocked from User Registry endpoints
- [ ] Sign-off: **Auth & Access Control** — Pass / Fail / Pass-with-notes: __________

---

## Phase 2 — Org & User Setup Workflows

- [ ] TC-ORG-2 — Duplicate site code rejected
- [ ] TC-ORG-3 — Duplicate admin email rejected
- [ ] TC-USR-2 — Duplicate user email rejected
- [ ] TC-USR-3 — Org isolation: Admin cannot see/edit users from another org
- [ ] TC-USR-4 — Role change restricted to allowed role list (cannot create/promote to Super_Admin via this endpoint)
- [ ] TC-USR-6 — Deactivating a user blocks their next login attempt
- [ ] Sign-off: **Org & User Management** — Pass / Fail / Pass-with-notes: __________

---

## Phase 3 — Core Daily Workflow (run for at least 3 consecutive simulated days)

Run this full chain for at least one Engineer + one Team_Leader + one Store_Manager + one Admin, repeated daily:

- [ ] **Day N morning:** Engineer requests van stock (TC-STK-1) → Store Manager approves (TC-STK-4) → confirm `EngineerStock` and `MainInventory` both update correctly
- [ ] **Day N field work:** Engineer submits productivity log with calls + accessory items (TC-PROD-1)
- [ ] Engineer attempts a second log for the same day → confirm blocked (TC-PROD-2)
- [ ] **Day N validation:** Team Leader validates the log (TC-PROD-5) — confirm engineer is notified
- [ ] **Day N approval:** Admin approves the validated log, assigns incentive per item (TC-PROD-8)
- [ ] Confirm after approval: Attendance shows "Present" for that engineer/date (TC-ATT-4), and EngineerStock for the logged accessory SKUs decremented by the logged qty
- [ ] Repeat with a TL **rejection** at least once (TC-PROD-6) and confirm the Engineer can resubmit (TC-PROD-7) and it re-enters the queue correctly
- [ ] Repeat with an Admin **rejection** at validated stage at least once (TC-PROD-10) and confirm no stock/attendance side effects were applied
- [ ] Sign-off: **Daily Productivity Loop** — Pass / Fail / Pass-with-notes: __________

---

## Phase 4 — Approval Center (merged screen)

- [ ] TC-APC-1 — Tab switching between Productivity / Attendance approvals works
- [ ] TC-APC-2 — Header pending-count badge matches the sum of both queues
- [ ] TC-APC-3 — Approve and reject actions inside the merged screen produce identical results to the cases already tested in Phase 3 (no regression from the UI merge)
- [ ] Sign-off: **Approval Center** — Pass / Fail / Pass-with-notes: __________

---

## Phase 5 — Stock & Inventory Side Workflows

- [ ] TC-PUR-1 — Store Manager creates a Purchase Inward entry
- [ ] TC-PUR-5 — Admin approves it; confirm `MainInventory.qty` increases by exactly the entered qty
- [ ] TC-PUR-7 — Attempt to approve the same entry twice; confirm second attempt is blocked
- [ ] TC-REV-1 through TC-REV-5 — Full revoke cycle on one approved stock request (submit → approve, and separately submit → reject) — confirm `MainInventory`/`EngineerStock` reconcile correctly in both branches
- [ ] TC-RTN-1 through TC-RTN-6 — Full return cycle: submit (qty ≤ on-hand) → approve, and a separate submit → reject → resubmit
- [ ] TC-RTN-3 — Attempt to submit a return for **more** than current on-hand qty; confirm blocked
- [ ] TC-SKU-1 — Store Manager registers a new SKU mid-pilot; confirm it appears immediately in Engineer's stock-request SKU dropdown
- [ ] TC-SKU-3 — Admin edits the SKU name/alert threshold; manually note that no audit trail will exist for this edit (known gap, log it manually outside the app if needed for traceability)
- [ ] Sign-off: **Stock & Inventory** — Pass / Fail / Pass-with-notes: __________

---

## Phase 6 — LP Requests & Claims

- [ ] TC-LP-1 — TL raises an LP request
- [ ] TC-LP-3 — Admin approves it, confirm it unlocks claim creation
- [ ] TC-CLM-1 — TL creates a claim against the approved LP
- [ ] TC-CLM-2 — Attempt a claim exceeding the LP's total cost; confirm blocked
- [ ] TC-CLM-3 — Attempt a second claim on the same LP; confirm blocked
- [ ] TC-CLM-5 — Store Manager validates the claim
- [ ] TC-CLM-7 — Admin gives final approval
- [ ] Run the parallel rejection branch at least once: TC-LP-4 (Admin rejects LP) and separately TC-CLM-6 (SM rejects claim) and TC-CLM-8 (Admin rejects validated claim)
- [ ] Sign-off: **LP & Claims** — Pass / Fail / Pass-with-notes: __________

---

## Phase 7 — Dashboards (all 5 roles, after Phases 3–6 have produced real data)

- [ ] TC-DSH-1 — Engineer Dashboard MTD figures match manual sum of that engineer's Approved logs
- [ ] TC-DSH-2 — TL Dashboard team totals match manual sum across the team's engineers
- [ ] TC-DSH-3 — Store Manager Dashboard pending counts match the actual open queues
- [ ] TC-DSH-4 — Admin Dashboard quick links and pending tiles route correctly to Approval Center
- [ ] TC-DSH-5 — Super Admin Dashboard org/user totals match Organisation + User Registry
- [ ] Sign-off: **Dashboards** — Pass / Fail / Pass-with-notes: __________

---

## Phase 8 — Concurrency & Multi-Tenant Stress (deliberately adversarial)

- [ ] TC-XW-2 — Two admins/store managers click Approve on the same pending record within ~1 second of each other (productivity, revoke, inward, return, stock request — pick at least 2 of these 5). Confirm exactly one succeeds and no double-deduction of inventory or incentive occurs.
- [ ] TC-XW-1 — If running multiple pilot orgs: attempt to register the same SKU ID in two different orgs. Confirm and document the actual failure behavior (expected: second org gets a 409).
- [ ] TC-PROD-9 / TC-REV-4 — Deliberately approve a productivity log or revoke request where the engineer's van stock is lower than the deducted qty. Confirm whether the system silently floors to 0 (known behavior) and decide if this is acceptable for go-live or must be fixed first.
- [ ] Sign-off: **Concurrency & Multi-Tenant** — Pass / Fail / Pass-with-notes: __________

---

## Phase 9 — End-of-Pilot Reconciliation

- [ ] For each seeded SKU, manually reconcile: starting qty + all Purchase Inward approvals − all Stock Request approvals + all Revoke/Return approvals = final `MainInventory.qty` shown in the app
- [ ] Cross-check 10 random state-changing actions performed during the pilot against the Audit Log screen — confirm each is present with correct actor, action, and timestamp
- [ ] Confirm no orphaned "Pending" records remain in any queue at pilot close (every Stock Request, Purchase Inward, Revoke Request, Return Request, Productivity Log, Staff Attendance, LP Request, and Claim Request should be in a terminal or intentionally-left-pending state)
- [ ] Collect pilot user feedback on any workflow that felt ambiguous, slow, or produced an unexpected result
- [ ] Final sign-off: **Pilot Complete** — Go / No-Go for production rollout: __________

---

## Escalation

If any **Critical**-risk test case fails during the pilot, stop testing that workflow, document the exact reproduction steps, and escalate before continuing — do not attempt to "test around" a failed Critical case to keep the pilot moving.
