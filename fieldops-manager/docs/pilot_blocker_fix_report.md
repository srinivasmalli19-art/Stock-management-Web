# Pilot Blocker Fix Sprint — Report

**Scope:** All 3 Critical (P0) and 6 High (P1) findings from `pre_launch_risk_assessment.md`. No new features, no UI redesign, no changes to workflows beyond what each fix required.
**Status:** Code complete. Schema migrations written but **not applied to any live database** — no `DATABASE_URL` was available in this environment, so the migrations are validated for syntax/correctness only (see "What Was Not Done" below). They must be run against a staging database before pilot start.

---

## 1. Fix Implementation

### P0-1 — Multi-Tenant SKU Uniqueness

**Problem:** `Sku.id` was both the primary key and the human-entered code (e.g. `"PART-001"`), so it was globally unique across the whole table — two organisations could never both register the same code.

**Fix:** Decoupled the internal primary key from the human-entered code.
- `Sku.id` is now an opaque generated id (`@default(cuid())`).
- A new `Sku.code` field holds the human-entered code.
- `@@unique([code, orgId])` replaces the old global uniqueness — the same code is now valid in any number of organisations.
- Every table with a `skuId` foreign key (`MainInventory`, `EngineerStock`, `ProductivityItem`, `StockRequest`, `ReturnRequest`, `PurchaseInward`, plus the denormalized `RevokeRequest.skuId` copy) continues to reference `Sku.id` — unchanged in shape, just pointing at the new generated value instead of the old code string.

**Files:**
- `backend/prisma/schema.prisma` — `Sku` model
- `backend/src/controllers/sku.controller.js` — `createSku` now does an org-scoped duplicate check (`code_orgId` compound key) instead of a global one; `getAllSkus` returns both `id` (internal, used for FK/edit references) and `code` (display)
- `backend/src/routes/sku.routes.js` — Joi schema field renamed `id` → `code`
- Every controller that returns a `sku` relation (`dashboard`, `inventory`, `productivity`, `purchaseInward`, `returnRequest`, `revokeRequest`, `stockRequest`) now selects `code` alongside `id`/`name` so the frontend can keep showing the human code instead of the internal id
- `backend/src/controllers/inventory.controller.js` — ordering switched from `skuId` (now meaningless cuid order) to `sku.code` for a stable, human-readable sort; CSV export now prints `sku.code` instead of the raw FK
- **9 frontend files** updated so every `SkuTag` and SKU dropdown shows `code` instead of the (now opaque) `id`/`skuId` value — see "Regression Review" below for the full list

### P0-2 — Inventory Integrity Protection

**Problem:** `Math.max(0, qty - deducted)` in three approval paths (productivity approval, revoke approval, return approval) silently floored a deduction at zero instead of rejecting it when the deduction exceeded available stock.

**Fix:** Every deduction now:
1. Pre-checks the engineer's actual on-hand quantity before starting the transaction, returning a clear `400` with the shortfall if insufficient — **and writes an audit log entry for the blocked attempt** (`PRODUCTIVITY_APPROVAL_BLOCKED_INSUFFICIENT_STOCK`, `REVOKE_APPROVAL_BLOCKED_INSUFFICIENT_STOCK`, `RETURN_REQUEST_APPROVAL_BLOCKED_INSUFFICIENT_STOCK`).
2. Performs the actual decrement inside the transaction as a **conditional `updateMany`** (`WHERE qty >= deductQty`) rather than an unconditional `update`. If the conditional update affects zero rows — meaning a concurrent transaction depleted the stock between the pre-check and the write — the whole transaction is rolled back and a `409` is returned instead of silently writing a wrong number.

No inventory is ever modified when a deduction can't be satisfied in full; nothing floors to zero anymore.

**Files:** `productivity.controller.js` (`approveLog`), `revokeRequest.controller.js` (`approveRevoke`), `returnRequest.controller.js` (`approveReturnRequest`)

### P0-3 — Organisation Deactivation Enforcement

**Problem:** Deactivating an `Organisation` (`isActive = false`) had no effect on whether its users could still log in or keep operating.

**Fix, in three places:**
1. **Login** (`auth.controller.js`) — after the existing user-active check, also rejects with `403` if the user belongs to an org and that org is deactivated.
2. **Refresh** (`auth.controller.js`) — same check, so a token refresh after the org is deactivated mid-session also fails.
3. **Every other authenticated request** — `requireOrg` middleware (used by 17 of the 20 route files) now does a **live DB read** on every request: confirms the user is still active, confirms their `orgId` still matches what's in the JWT (catches a stale token after a Super_Admin reassignment), and confirms the org is still active. Any failure returns a clear, actionable error and forces re-login.

This is the single choke-point that also satisfies P1-9 below — see that section for why it's covered by the same change.

### P1-4 — Approval Race-Condition Protection

**Problem:** Approval flows for Purchase Inward, Revoke, Productivity, and Return Requests read a record's status, checked it in application code, then issued a separate `update` — a classic check-then-act race where two concurrent approval clicks could both pass the check before either write landed.

**Fix:** Every approve action (and Purchase Inward's reject) now claims the record atomically with `updateMany({ where: { id, status: "<expected>" }, ... })` and checks `result.count === 1`. If a concurrent request already claimed it, `count` is `0`, the transaction throws, and the caller gets a clean `409 — already processed` instead of a double-applied side effect (double inventory deduction, double notification, etc).

**Files:** `productivity.controller.js`, `revokeRequest.controller.js`, `returnRequest.controller.js`, `purchaseInward.controller.js`

### P1-5 — Positive Quantity Validation

**Audit finding:** This was already enforced at the Joi route-validation layer for Stock Requests, Return Requests, Productivity accessory items, and Purchase Inward (`qty: Joi.number().integer().min(1).required()`) — confirmed by reading each route file, not assumed.

**The one real gap:** `stockRequest.routes.js`'s `PATCH /:id/resubmit` endpoint had **no validation middleware at all**, so a resubmitted stock request's `qty` could be anything. Fixed by adding a `resubmitSchema` (`qty: Joi.number().integer().min(1).optional()`) to that route.

### P1-6 — Future Date Validation

**Fix:** 
- `productivity.routes.js` — `date` field changed from `Joi.string().isoDate()` to `Joi.date().iso().max("now")`, blocking productivity logs dated after the current moment.
- `staffAttendance.routes.js` — `date` field changed from a bare regex pattern to `Joi.date().iso().max("now")`, same effect for staff attendance submissions.

(Joi's date coercion is validation-only — `validate.js` does not overwrite `req.body`, so controllers still receive and parse the original string exactly as before; this is a pure additive guard.)

### P1-7 — Duplicate Invoice Protection

**Fix:**
- `PurchaseInward.invoiceNo` changed from a required `String` (defaulting to the placeholder `"N/A"`) to a nullable `String?`.
- New constraint: `@@unique([orgId, vendor, invoiceNo])`. Postgres treats `NULL` as distinct in unique indexes, so entries genuinely submitted without an invoice number never collide with each other — only real, repeated (vendor, invoice number) pairs within the same org are blocked.
- `createInward` normalizes blank input to `null` and pre-checks for a duplicate before insert, returning a clear `409` naming the vendor and invoice number rather than a generic constraint-violation message.

### P1-8 — Purchase Approval Notifications

**Fix:** Added `PurchaseInward.createdById` (nullable, set on every new entry going forward; historical rows have no recorded submitter and are simply skipped). `approveInward` and `rejectInward` now notify that user with a clear approved/rejected message, mirroring the pattern already used by every other workflow (productivity, stock requests, returns, revokes, LP, claims).

### P1-9 — Token Freshness Protection

**Fix:** Covered by the same `requireOrg` middleware change described under P0-3. Because that middleware re-reads the user's live `isActive`, `orgId`, and `org.isActive` from the database on every protected request (not just at login), a JWT issued before an org reassignment or deactivation stops working on the very next request after the change — the user is told to log in again rather than silently continuing to operate under stale claims.

---

## 2. Database Migrations

Two new migrations were written under `backend/prisma/migrations/`:

### `20260624000001_sku_org_scoped_uniqueness`
Implements P0-1. Strategy, in order:
1. Adds `Sku.code`, copies the existing `id` value into it (preserves every existing code).
2. Adds a new generated internal id (`newId`) to `Sku`.
3. For every dependent table (`MainInventory`, `EngineerStock`, `ProductivityItem`, `StockRequest`, `ReturnRequest`, `PurchaseInward`, and the FK-less `RevokeRequest.skuId` copy), adds a `newSkuId` column and backfills it via a join against the old `Sku.id` — so every existing relationship is preserved before anything is dropped.
4. Drops the old FK/unique constraints, drops the old `skuId`/`id` columns, renames the new columns into place.
5. Re-adds every FK and unique constraint against the new `Sku.id`, plus the new `@@unique([code, orgId])`.

No row in any of these tables is deleted or orphaned by this migration — it is purely a key-remapping operation.

### `20260624000002_purchase_inward_creator_and_invoice_guard`
Implements P1-7 / P1-8:
1. Makes `invoiceNo` nullable; normalizes the historical `"N/A"` placeholder to `NULL`.
2. **Defensively deduplicates** any pre-existing accidental `(orgId, vendor, invoiceNo)` collisions before adding the constraint — keeps the earliest row's invoice number, nulls out the rest — so the migration cannot fail even if duplicate data already exists.
3. Adds the `@@unique([orgId, vendor, invoiceNo])` constraint.
4. Adds the nullable `createdById` column and its FK to `User`.

### What was verified, and what was not
- `npx prisma validate` and `npx prisma generate` both ran successfully against the final schema (using a placeholder `DATABASE_URL`, since no real database is reachable from this environment) — confirming the Prisma schema itself is internally consistent and all relations resolve correctly.
- **The migration SQL has not been executed against any real database.** There is no `DATABASE_URL`/staging database available in this environment. The SQL was hand-written against the exact constraint names found in the existing migration history (`grep`-verified, not guessed) and follows a standard safe add-column → backfill → swap → drop pattern, but it must be run against a copy of the actual staging/pilot database before being trusted, per standard migration hygiene — **this is the one explicit action item before pilot start.**

---

## 3. Security Review

- **Org deactivation / reassignment** now fails closed: any ambiguity (missing org, missing user, mismatched orgId) returns a 401/403 rather than allowing the request through. No bypass path was left for any role, including Super_Admin (whose own `isActive` flag is now also re-checked live).
- **Race-condition fixes use atomic `updateMany` + count check**, not advisory locks or `SELECT ... FOR UPDATE` — this is correct for Postgres's default read-committed isolation and avoids introducing lock contention or deadlock risk under the pilot's expected concurrency (a handful of admins, not a high-throughput system).
- **No secrets, tokens, or credentials were touched.** Cookie/CORS/JWT configuration from prior hardening sprints is untouched.
- **SKU code uniqueness fix closes a real multi-tenant boundary violation** — before this fix, organisation A's data model could collide with organisation B's at the SKU level, which is the kind of cross-tenant interference a pilot with more than one organisation must not have.
- **Duplicate-invoice constraint is scoped per-organisation** (`orgId` is part of the compound key) — it cannot be used to infer or block based on another organisation's purchase history.
- The new `requireOrg` DB read happens on every protected request. This is a deliberate, necessary trade-off (correctness over a microsecond of latency) at pilot scale; flagged in "Potential Follow-Ups" below for awareness at higher scale.

---

## 4. Regression Review

**Backend:**
- `npx prisma validate` — passed
- `npx prisma generate` — passed, client regenerated against the new schema
- `node --check` run against every modified controller, route, and middleware file — all passed (syntax-level only; no live DB available to run integration tests)
- Confirmed via direct route-file reads that existing Joi validation for qty positivity was already correct everywhere except the one stock-request resubmit gap that was fixed
- Confirmed `prisma/seed.js` already predates the org-scoping work (it doesn't set `orgId` on `Sku`/`User` creation, which is required in the current schema) — it was **already broken before this sprint**, independent of these changes, and was left untouched as out-of-scope pre-existing breakage rather than rewritten under this fix-only sprint
- Confirmed `scripts/phase_c_audit.js`'s raw-SQL FK-orphan checks (`Sku.id` existence checks) remain structurally valid — they don't depend on `id` being the human code, only on it being the PK

**Frontend (9 files updated, all SKU-display call sites traced individually, not blanket-replaced):**
- `StoreSkuRegistry.jsx`, `AdminSkuRegistry.jsx` — create/edit forms now submit `code` instead of `id`; catalog tables and the edit modal display `s.code`
- `EngProductivity.jsx`, `EngVanStock.jsx`, `StorePurchaseInward.jsx` — SKU dropdowns now show `{code} – {name}` while still submitting the real internal `id` as the form value (unchanged FK behavior)
- `EngVanStock.jsx`, `StoreReturnRequests.jsx`, `StoreStockRequests.jsx`, `StoreDashboard.jsx`, `AdminInventory.jsx`, `AdminApprovals.jsx`, `AdminPurchaseApprovals.jsx`, `AdminRevokeApprovals.jsx` — every `<SkuTag>` that was rendering a raw `skuId` FK value now renders the corresponding `sku.code` (or the flattened `skuCode`/`skuId` field added to `MainInventory`/`RevokeRequest` API responses)
- Verified internal joins that compare `skuId` values against each other for business logic (e.g. `getInvQty(skuId)` matching a `StockRequest.skuId` against `MainInventory.skuId` in `StoreStockRequests.jsx`/`AdminPurchaseApprovals.jsx`/`AdminRevokeApprovals.jsx`) were **left untouched** — both sides of those comparisons reference the same internal id space before and after the migration, so they continue to work correctly without modification
- `npm run build` (Vite) — succeeded, 0 errors, 0 warnings, after every change

**Not modified:** no UI layout, typography, navigation, or component redesign. No business workflow's approval sequence, role permissions, or state machine changed — only the validation/integrity boundaries named in the brief.

---

## 5. Build Verification

```
Backend:
  npx prisma validate  → "The schema at prisma\schema.prisma is valid"
  npx prisma generate  → "✔ Generated Prisma Client (v5.22.0)"
  node --check <every modified .js file> → all passed

Frontend:
  npm run build (vite v5.4.21)
  ✓ 2745 modules transformed
  ✓ built in 10.39s
  0 errors, 0 warnings
```

---

## 6. Action Items Before Pilot Start

1. **Run both new migrations against a staging copy of the real database first**, not production directly. Verify row counts on `Sku`, `MainInventory`, `EngineerStock`, `ProductivityItem`, `StockRequest`, `ReturnRequest`, `PurchaseInward`, and `RevokeRequest` are identical before and after — this is the standard sanity check for any key-remapping migration, and it could not be performed in this environment.
2. If any pilot organisation already has real `PurchaseInward` data with genuine duplicate `(vendor, invoiceNo)` pairs predating this fix, confirm the deduplication step's choice (keep-earliest) matches what the business actually wants for those specific historical records.
3. Re-run the existing pilot test plan's SKU-related test cases (`TC-SKU-1` through `TC-SKU-5`, `TC-XW-1`) against the migrated database to close out the corresponding findings in `pre_launch_risk_assessment.md`.
4. `prisma/seed.js` is pre-existing broken dev tooling (unrelated to this sprint) — if local/CI seeding is needed before pilot, it will need a separate, dedicated fix to set `orgId` on seeded records.
