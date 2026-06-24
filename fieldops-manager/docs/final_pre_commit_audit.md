# Final Pre-Commit Audit — Pilot Blocker Fix Sprint

**Status:** Analysis only. No code modified, nothing committed, no migration executed to produce this document.
**Scope:** Every file currently shown by `git status` as modified (`M`) or untracked (`??`) — 28 modified source files, 2 new migration folders, 6 new doc files. Each of the 15 requested checks was run against this exact file set, not the repository as a whole.

```
Modified (28):  backend/prisma/schema.prisma
                backend/src/controllers/{auth,dashboard,inventory,productivity,purchaseInward,
                  returnRequest,revokeRequest,sku,stockRequest}.controller.js
                backend/src/middlewares/requireOrg.js
                backend/src/routes/{productivity,sku,staffAttendance,stockRequest}.routes.js
                frontend/src/pages/admin/{AdminApprovals,AdminInventory,AdminPurchaseApprovals,
                  AdminRevokeApprovals,AdminSkuRegistry}.jsx
                frontend/src/pages/engineer/{EngProductivity,EngVanStock}.jsx
                frontend/src/pages/storemanager/{StoreDashboard,StoreInventoryReport,
                  StorePurchaseInward,StoreReturnRequests,StoreSkuRegistry,StoreStockRequests}.jsx

New (8):        backend/prisma/migrations/20260624000001_sku_org_scoped_uniqueness/
                backend/prisma/migrations/20260624000002_purchase_inward_creator_and_invoice_guard/
                docs/{migration_safety_review,pilot_blocker_fix_report,pilot_execution_checklist,
                  pilot_testing_plan,pre_launch_risk_assessment,pre_pilot_deployment_checklist}.md
```

**Method:** Full `git diff` read for every modified file (not summaries); `node --check` re-run against every modified `.js` file; `npx prisma validate` + `npx prisma generate` re-run against the modified schema; `npm run build` re-run for the frontend; `grep` sweeps for debug markers across the entire changed-file set; manual trace of every `authorize()`/`requireOrg`/`orgId` line in every modified controller and route file; manual trace of every Express route registration in `server.js` and each modified route file.

---

## Critical Issues

### C1 — `requireOrg` middleware is async with no error handling; a single transient DB error can crash the entire backend process

**File:** `backend/src/middlewares/requireOrg.js`

This sprint converted `requireOrg` from a synchronous function to an `async` function that makes two `prisma.user.findUnique()` calls (one per branch) so it can re-verify live org/user status on every request. It is registered as bare middleware — `router.use(requireOrg)` — in **16 separate route files** (`attendance`, `attendanceLedger`, `auditLog`, `claimRequest`, `dashboard`, `inventory`, `lpRequest`, `productivity`, `purchaseInward`, `reports`, `returnRequest`, `revokeRequest`, `sku`, `staffAttendance`, `stockRequest`, `user`), confirmed by direct grep, not assumed.

Every controller in this codebase that performs an async operation is wrapped in `asyncHandler` (`backend/src/utils/asyncHandler.js`: `Promise.resolve(fn(...)).catch(next)`), which routes any rejected promise to `errorHandler.js`. **`requireOrg` is the only async function anywhere in `backend/src/middlewares/` and it is not wrapped in `asyncHandler` or any equivalent try/catch.** If either `prisma.user.findUnique()` call rejects — a connection drop, a brief pool-exhaustion, any transient database error, all of which happen periodically against any real production database — the rejection is unhandled. Express never calls `next(err)`, so the request hangs with no response, and per Node.js's default behavior since v15 (confirmed applicable: `package.json` declares `"engines": { "node": ">=18.0.0" }`), an **unhandled promise rejection terminates the entire process**.

Because this middleware now runs on nearly every authenticated request across the whole application, this is not a "one request fails" bug — it is a **full-outage risk triggered by an ordinary, expected category of transient database error**, introduced specifically by this sprint's P0-3/P1-9 fix. The previous synchronous version of `requireOrg` had no database calls and therefore no equivalent risk.

**Evidence trail:** `grep -n "async" backend/src/middlewares/*.js` returns only `requireOrg.js`; `grep -rn "process.on('unhandledRejection'" backend/` returns nothing — there is no global safety net catching this anywhere in the application.

**This must be fixed before commit.** The minimal fix is wrapping the function with the project's own existing `asyncHandler` utility at export time or at each `router.use()` call site — the codebase already has the right tool for this, it simply wasn't applied to this one new piece of middleware.

---

## High Issues

### H1 — The two new migration folders are not committed

**Files:** `backend/prisma/migrations/20260624000001_sku_org_scoped_uniqueness/`, `backend/prisma/migrations/20260624000002_purchase_inward_creator_and_invoice_guard/`

Confirmed via `git status` — both show as untracked (`??`), not staged. This was already flagged in `pre_pilot_deployment_checklist.md`'s Go/No-Go list and `pilot_blocker_fix_report.md`, repeated here because this audit's job is to catch exactly this kind of pre-commit gap: `schema.prisma` (already modified/tracked) describes a database shape that does not exist anywhere without these two migration folders. Committing the schema change without the migrations would leave the repository in an inconsistent, non-deployable state the moment someone runs `prisma migrate deploy` expecting the schema to match reality.

### H2 — Reject-path race protection is inconsistent with approve-path race protection (non-destructive, but worth a conscious decision)

**Files:** `revokeRequest.controller.js` (`rejectRevoke`), `returnRequest.controller.js` (`rejectReturnRequest`), `productivity.controller.js` (`rejectTL`, `rejectAdmin`)

This sprint added atomic `updateMany`-based race protection to every **approve** action (Productivity, Revoke, Return, Purchase Inward) and to Purchase Inward's **reject** action, per the explicit P1-4 scope ("Ensure double approval cannot occur"). The **reject** actions for Revoke, Return, and Productivity were intentionally left on the older check-then-update pattern, since this was out of the sprint's literal scope and a double-reject race is not destructive (the second writer would, at worst, redundantly set an already-`Rejected` record to `Rejected` again — no inventory or financial double-effect). Flagging this as High rather than Medium only because it's an **inconsistency in a security-relevant pattern within the same sprint** that a future reader could reasonably assume was applied everywhere; it is not a functional bug today, but it is the kind of gap that should be a documented, deliberate decision rather than an implicit one.

---

## Medium Issues

### M1 — Minor grammatical awkwardness in three new user-facing error messages

**Files:** `productivity.controller.js`, `revokeRequest.controller.js`, `returnRequest.controller.js`

All three new insufficient-stock error messages use the phrasing "...but the revoke requests {qty}" / "...but the return requests {qty}" (e.g. *"engineer has only 2 unit(s) on hand, but the return requests 5"*). This reads as a typo-shaped sentence (likely intended as "...but the return request needs 5" or "...requests 5 units"). Not a functional defect — the message is still comprehensible and the `400`/error path works correctly — but worth a copy pass before pilot users see it, since these are exactly the messages a Store Manager or Admin will read when an approval is blocked.

### M2 — `npm run lint` is non-functional in both `backend` and `frontend`, pre-dating this sprint

**Files:** N/A (tooling gap, not a changed file)

Running `npx eslint` against the modified files in either package fails immediately with "ESLint couldn't find a configuration file" — neither package has an ESLint config despite both `package.json` files defining a `lint` script. This is a pre-existing condition, not introduced or worsened by this sprint, and is mentioned here only because this audit's "no syntax issues / no unused imports" checks could not be cross-verified with the project's own designated lint tool and had to rely on `node --check` (syntax only) plus manual read-through (semantic/unused-import checking) instead. Manual review found no unused imports or dead code in any modified file (see Low section), but a real linter would have caught this category of issue with more confidence than manual review alone.

---

## Low Issues

### L1 — No console.log/debugger/TODO/FIXME leftovers

Swept the full diff (`git diff | grep -iE "console\.|debugger;|TODO|FIXME|XXX"`) across every modified file and both new migration SQL files — zero matches. Clean.

### L2 — No unused imports introduced

Every new import added this sprint is used: `requireOrg.js`'s new `const prisma = require("../config/db")` (used twice), `purchaseInward.controller.js`'s new `const { writeNotification } = require("../utils/notificationService")` (used twice). No frontend file gained a new import — all frontend changes were string-literal swaps (`s.id` → `s.code`, etc.) inside already-imported components.

### L3 — No missing exports

Checked `module.exports` in all 9 modified controllers against their route files' `require(...)` destructuring — every exported function is still present and every function a route file expects is still exported. No function was renamed or removed without updating its export.

### L4 — No duplicate route registration

Checked `server.js`'s 19 `app.use("/api/...")` mounts (all unique paths, unchanged this sprint) and each modified route file individually (`stockRequest.routes.js`, `sku.routes.js`, `productivity.routes.js`, `staffAttendance.routes.js`) for duplicate `router.{get,post,patch}` registrations on the same path+verb — none found. The one new line added (`stockRequest.routes.js`'s `resubmitSchema`) attaches to the pre-existing `/:id/resubmit` registration via `validate(...)`, it does not add a second route.

### L5 — No missing `authorize()` middleware on modified or new routes

Every route touched this sprint retains its pre-existing `authorize(...)` call exactly as before — this sprint only changed Joi validation schemas (`productivity.routes.js`, `staffAttendance.routes.js`, `sku.routes.js`) and added one (`stockRequest.routes.js`'s resubmit endpoint), never the authorization layer itself. No route lost its role gate.

### L6 — No missing `orgId` filters in modified controllers

Traced every modified controller function for its pre-existing org-isolation check and confirmed each is still present, unchanged, and positioned correctly relative to the new logic added around it: `auth.controller.js` (N/A — pre-org-context by design), `dashboard.controller.js`/`inventory.controller.js`/`stockRequest.controller.js` (only `select`/`orderBy` clauses changed, org `where` clauses untouched), `productivity.controller.js`/`purchaseInward.controller.js`/`returnRequest.controller.js`/`revokeRequest.controller.js` (the `if (req.user.role !== "Super_Admin" && X.orgId !== req.user.orgId) return error(...)` guard is present in every approve/reject function, sitting above the new atomic-transaction logic), `sku.controller.js` (the entire point of this sprint's schema change is to make `orgId` scoping work correctly for SKU codes — confirmed `orgId` is used in both the uniqueness check and the create call).

### L7 — No UI routes pointing to removed pages, no broken dashboard links

This sprint added/removed no routes, pages, or components in the frontend — every change is a display-string substitution (`SkuTag id={x.skuId}` → `SkuTag id={x.sku?.code}` or equivalent) inside components that already existed and are already correctly routed from a prior sprint. `App.jsx` was not touched this sprint; no dashboard quick-link or route target changed.

### L8 — No broken Prisma references

`npx prisma validate` and `npx prisma generate` both re-run clean against the current `schema.prisma` (placeholder `DATABASE_URL`, schema-only operations). Every compound-unique-key reference added in controller code (`code_orgId` in `sku.controller.js`, `orgId_vendor_invoiceNo` in `purchaseInward.controller.js`) matches the exact field order declared in the corresponding `@@unique([...])` in `schema.prisma` — Prisma's default compound-key naming convention requires this exact ordering to resolve, and both were checked field-by-field, not assumed.

### L9 — No migration ordering issues

`20260624000001_sku_org_scoped_uniqueness` and `20260624000002_purchase_inward_creator_and_invoice_guard` sort correctly after the existing latest migration (`20260623000007_add_return_request`) and in the correct relative order to each other. They touch non-overlapping columns of `PurchaseInward` (migration 1 only remaps `skuId`; migration 2 only touches `invoiceNo`/`createdById`) — no statement in either migration depends on uncommitted state from the other being applied first or out of order.

### L10 — No build-breaking changes

`node --check` passed on every modified `.js` file (re-run during this audit, not assumed from a prior session). `npm run build` (Vite) re-run during this audit: `✓ 2745 modules transformed`, **0 errors, 0 warnings**, built in 11.44s.

### L11 — No dead code

Manually traced each rewritten approve/reject function (`productivity.controller.js`'s `approveLog`, `revokeRequest.controller.js`'s `approveRevoke`, `returnRequest.controller.js`'s `approveReturnRequest`, `purchaseInward.controller.js`'s `approveInward`/`rejectInward`) end-to-end after the refactor — no leftover unused variables from the pre-refactor version (e.g. the old `const stock = await tx.engineerStock.findUnique(...)` pattern was fully replaced, not left alongside the new `updateMany` call).

---

## Safe To Commit?

# NO

**Blocking item: C1.** A `requireOrg` middleware that can crash the entire backend process on an ordinary transient database error is not something to commit and fix later — it sits in front of nearly every authenticated route in the application, so the failure mode is not "one feature breaks," it's "the whole pilot goes down because Postgres hiccuped for a moment." This is a correctness defect introduced by this sprint, not a pre-existing condition, and it is straightforward to fix using a pattern already established elsewhere in this exact codebase (`asyncHandler`).

**Also required before commit, not just before deploy:** H1 (commit the two migration folders alongside the schema change — committing `schema.prisma` alone, without them, leaves the repository describing a database that the migration history doesn't actually produce).

**Once C1 is fixed and H1's migration folders are included in the same commit, this changeset is otherwise clean:** no debug leftovers, no unused imports, no missing exports, no duplicate routes, no missing authorization or org-isolation checks, no broken Prisma references, no migration ordering issues, no broken UI routes, and the build is green end to end. H2 and the Medium/Low items are recommended follow-ups, not commit blockers.
