# Migration Safety Review — Pilot Blocker Fix Sprint

**Scope:** Static review only. No code was modified, no migration was executed, nothing was committed. Reviewed:
1. `backend/prisma/schema.prisma` (current state)
2. `backend/prisma/migrations/20260624000001_sku_org_scoped_uniqueness/migration.sql`
3. `backend/prisma/migrations/20260624000002_purchase_inward_creator_and_invoice_guard/migration.sql`

**Method:** Every statement in both migration files was traced against the corresponding model in `schema.prisma` to confirm the end state matches, and against the original migration history (`20240101000000_init` and subsequent files) to confirm every `DROP CONSTRAINT`/`DROP COLUMN` target name actually exists in the deployed schema rather than being assumed. No live database was available to execute either migration — this review is necessarily based on reading the SQL and the schema, not on an observed dry-run.

---

## How to read the per-statement tables

- **Risk Level** — likelihood and blast radius of something going wrong *at this specific statement*.
- **Data Loss Risk** — Yes/No, whether the statement can destroy a value that was meaningful before the statement ran. A column being renamed or temporarily duplicated is **not** data loss; a value being overwritten or nulled **is**, even if no row is deleted.
- **Rollback Possible** — whether *this individual statement* has a trivial single-command inverse. Many steps in migration 1 are only safe because of the *sequence* they sit in (data is copied forward before the source is dropped) — those are marked "No (sequence-dependent)" with the whole-migration rollback strategy covered separately below the table.

---

## Migration 1 — `20260624000001_sku_org_scoped_uniqueness`

**Net effect on schema.prisma:** `Sku.id` changes from the old user-entered code (`@id`, no default) to an opaque generated key (`@id @default(cuid())`); the old code value is preserved in a new `Sku.code String` field; uniqueness moves from "global on id" to `@@unique([code, orgId])`. Every dependent table's `skuId` foreign key is remapped to point at the new key. This matches the SQL below exactly — confirmed field-by-field.

### Phase 1 — Preserve the old code, generate the new internal id

| # | Exact Statement | Purpose | Risk | Data Loss | Rollback | Notes |
|---|---|---|---|---|---|---|
| 1 | `ALTER TABLE "Sku" ADD COLUMN "code" TEXT;` | Add the new human-readable code column (nullable for now) | Low | No | Yes (`DROP COLUMN "code"`) | Purely additive; no existing row is touched |
| 2 | `UPDATE "Sku" SET "code" = "id";` | Copy the current (globally-unique) id into the new code column, preserving every existing SKU's code | Low | No | Yes, while `id` still holds the original value (true until statement 49) | This is the step that "preserves existing records" for P0-1 — it is a straight 1:1 copy, no transformation |
| 3 | `ALTER TABLE "Sku" ADD COLUMN "newId" TEXT;` | Stage the future internal primary key in a side column | Low | No | Yes (`DROP COLUMN "newId"`) | Additive |
| 4 | `ALTER TABLE "Sku" SET "newId" = 'sku_' \|\| substr(md5(random()::text \|\| clock_timestamp()::text \|\| "id"), 1, 24);` *(as written: `UPDATE`)* | Generate a new opaque unique id per row | **Medium** | No | Yes, while old `id` and new `newId` both exist | Collision probability is astronomically low (random + timestamp + the row's own previously-unique id are all hashed together), and even in the impossible case of a collision, statement 52 (`ADD CONSTRAINT ... PRIMARY KEY`) would fail loudly and abort the whole transaction rather than silently merging two SKUs — see "Self-Validating Design" note below |

### Phase 2 — Remap every dependent table's foreign key to the new id

Repeated identically for 6 tables (`MainInventory`, `EngineerStock`, `ProductivityItem`, `StockRequest`, `ReturnRequest`, `PurchaseInward`) plus the FK-less `RevokeRequest.skuId` copy:

| # | Exact Statement | Purpose | Risk | Data Loss | Rollback | Notes |
|---|---|---|---|---|---|---|
| 5 | `ALTER TABLE "MainInventory" ADD COLUMN "newSkuId" TEXT;` | Stage remapped FK | Low | No | Yes | Additive |
| 6 | `UPDATE "MainInventory" m SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = m."skuId";` | Populate the remapped FK by joining on the *old* id, which still exists at this point | **Medium** | No, **unless a pre-existing orphan exists** | Yes, while old `skuId` column still exists | If any `MainInventory.skuId` does not match any `Sku.id` today (a pre-existing data-integrity violation that should be impossible given the original FK constraint was always enforced), `newSkuId` is left `NULL` for that row. This is caught — not silently passed — by statement 29 (`SET NOT NULL`), which would fail the whole transaction. See "Self-Validating Design" below |
| 7 | `ALTER TABLE "EngineerStock" ADD COLUMN "newSkuId" TEXT;` | Same as #5, for EngineerStock | Low | No | Yes | — |
| 8 | `UPDATE "EngineerStock" e SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = e."skuId";` | Same as #6, for EngineerStock | Medium | No* | Yes (interim) | *Same orphan caveat as #6 |
| 9 | `ALTER TABLE "ProductivityItem" ADD COLUMN "newSkuId" TEXT;` | Same as #5, for ProductivityItem | Low | No | Yes | — |
| 10 | `UPDATE "ProductivityItem" p SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = p."skuId";` | Same as #6, for ProductivityItem | Medium | No* | Yes (interim) | Same orphan caveat |
| 11 | `ALTER TABLE "StockRequest" ADD COLUMN "newSkuId" TEXT;` | Same as #5, for StockRequest | Low | No | Yes | — |
| 12 | `UPDATE "StockRequest" r SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = r."skuId";` | Same as #6, for StockRequest | Medium | No* | Yes (interim) | Same orphan caveat |
| 13 | `ALTER TABLE "ReturnRequest" ADD COLUMN "newSkuId" TEXT;` | Same as #5, for ReturnRequest | Low | No | Yes | — |
| 14 | `UPDATE "ReturnRequest" r SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = r."skuId";` | Same as #6, for ReturnRequest | Medium | No* | Yes (interim) | Same orphan caveat |
| 15 | `ALTER TABLE "PurchaseInward" ADD COLUMN "newSkuId" TEXT;` | Same as #5, for PurchaseInward | Low | No | Yes | — |
| 16 | `UPDATE "PurchaseInward" p SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = p."skuId";` | Same as #6, for PurchaseInward | Medium | No* | Yes (interim) | Same orphan caveat |
| 17 | `ALTER TABLE "RevokeRequest" ADD COLUMN "newSkuId" TEXT;` | Stage remap for the denormalized, non-FK-enforced copy | Low | No | Yes | — |
| 18 | `UPDATE "RevokeRequest" r SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = r."skuId";` | Populate remapped value | Medium | No* | Yes (interim) | **This column has no FK constraint, before or after this migration** — an orphan here would *not* be caught by a later `SET NOT NULL` failure in the same way the others are, because there is no FK to violate. See "RevokeRequest is the one residual integrity gap" in Notes below |

### Phase 3 — Drop the old FK/unique constraints (clears the way to drop the old columns)

| # | Exact Statement | Purpose | Risk | Data Loss | Rollback | Notes |
|---|---|---|---|---|---|---|
| 19 | `ALTER TABLE "MainInventory" DROP CONSTRAINT "MainInventory_skuId_fkey";` | Remove old FK so the old `skuId` column can be dropped | Low | No | No (sequence-dependent — recreated in Phase 6) | Constraint name confirmed against `20240101000000_init/migration.sql` line 185 |
| 20 | `ALTER TABLE "MainInventory" DROP CONSTRAINT "MainInventory_skuId_key";` | Remove old unique index on the soon-to-be-dropped column | Low | No | No (sequence-dependent) | Confirmed against init migration line 164 |
| 21 | `ALTER TABLE "EngineerStock" DROP CONSTRAINT "EngineerStock_skuId_fkey";` | Same, for EngineerStock | Low | No | No (sequence-dependent) | Confirmed against init migration line 191 |
| 22 | `ALTER TABLE "EngineerStock" DROP CONSTRAINT "EngineerStock_engineerId_skuId_key";` | Remove old compound unique index | Low | No | No (sequence-dependent) | Confirmed against init migration line 167 |
| 23 | `ALTER TABLE "ProductivityItem" DROP CONSTRAINT "ProductivityItem_skuId_fkey";` | Same, for ProductivityItem | Low | No | No (sequence-dependent) | Confirmed against init migration line 200 |
| 24 | `ALTER TABLE "StockRequest" DROP CONSTRAINT "StockRequest_skuId_fkey";` | Same, for StockRequest | Low | No | No (sequence-dependent) | Confirmed against init migration line 212 |
| 25 | `ALTER TABLE "ReturnRequest" DROP CONSTRAINT "ReturnRequest_skuId_fkey";` | Same, for ReturnRequest | Low | No | No (sequence-dependent) | Confirmed against `20260623000007_add_return_request/migration.sql` line 29 (this table was added after init) |
| 26 | `ALTER TABLE "PurchaseInward" DROP CONSTRAINT "PurchaseInward_skuId_fkey";` | Same, for PurchaseInward | Low | No | No (sequence-dependent) | Confirmed against init migration line 215 |

### Phase 4 — Swap old/new columns on every dependent table

Identical 3-statement pattern repeated for all 7 tables (`MainInventory`, `EngineerStock`, `ProductivityItem`, `StockRequest`, `ReturnRequest`, `PurchaseInward`, `RevokeRequest`):

| # | Exact Statement (MainInventory shown; same pattern × 7 tables) | Purpose | Risk | Data Loss | Rollback | Notes |
|---|---|---|---|---|---|---|
| 27 | `ALTER TABLE "MainInventory" DROP COLUMN "skuId";` | Remove the old FK column (now disconnected from any constraint) | **Medium** | **No, conditional** | No (sequence-dependent — value already copied into `newSkuId` by Phase 2) | Data loss would only occur here if the corresponding Phase-2 `UPDATE` had not run first — it has, by construction. This is the step that makes Phase 2's correctness load-bearing |
| 28 | `ALTER TABLE "MainInventory" RENAME COLUMN "newSkuId" TO "skuId";` | Promote the remapped column to the real name | Low | No | Yes (`RENAME COLUMN "skuId" TO "newSkuId"`) | Pure metadata rename, no row rewrite |
| 29 | `ALTER TABLE "MainInventory" ALTER COLUMN "skuId" SET NOT NULL;` | Re-enforce non-null | **Medium** | No | Yes (`DROP NOT NULL`) | **This is the safety net for Phase 2's orphan caveat** — if any row's join in statement 6 failed to find a match, this statement fails and the entire transaction rolls back. A failure here is a loud, transaction-aborting error, not silent corruption |
| 30–32 | *(same 3-statement pattern for `EngineerStock`)* | — | Medium | No (same conditional logic) | No (sequence-dependent) | Same caveats apply |
| 33–35 | *(same 3-statement pattern for `ProductivityItem`)* | — | Medium | No | No (sequence-dependent) | Same caveats apply |
| 36–38 | *(same 3-statement pattern for `StockRequest`)* | — | Medium | No | No (sequence-dependent) | Same caveats apply |
| 39–41 | *(same 3-statement pattern for `ReturnRequest`)* | — | Medium | No | No (sequence-dependent) | Same caveats apply |
| 42–44 | *(same 3-statement pattern for `PurchaseInward`)* | — | Medium | No | No (sequence-dependent) | Same caveats apply |
| 45–47 | *(same 3-statement pattern for `RevokeRequest`)* | — | Medium | No | No (sequence-dependent) | **No `SET NOT NULL` safety-net difference here** — this table has no FK, so statement 47 still catches a NULL (the column itself is declared `String` not `String?` in schema, so `SET NOT NULL` still runs and still catches orphans at the column level), but a *wrong but non-null* remap would not be caught by any constraint, only by the FK-less nature of this field already being an accepted, pre-existing risk |

### Phase 5 — Swap Sku's own primary key

| # | Exact Statement | Purpose | Risk | Data Loss | Rollback | Notes |
|---|---|---|---|---|---|---|
| 48 | `ALTER TABLE "Sku" DROP CONSTRAINT "Sku_pkey";` | Remove the old primary key so the old `id` column can be dropped | **Medium** | No | No (sequence-dependent) | Safe only because, by this point, every dependent table's FK has already been re-pointed away from the old `id` (Phases 3–4 ran first) — confirmed correct ordering; reversing the order would cause Postgres to refuse this step |
| 49 | `ALTER TABLE "Sku" DROP COLUMN "id";` | Remove the old code-as-id column | **Medium** | **No, conditional** | No (sequence-dependent — value already preserved in `code` by statement 2) | Same load-bearing dependency as statement 27 |
| 50 | `ALTER TABLE "Sku" RENAME COLUMN "newId" TO "id";` | Promote the new generated key to be the real `id` | Low | No | Yes (rename back) | Pure metadata rename |
| 51 | `ALTER TABLE "Sku" ALTER COLUMN "id" SET NOT NULL;` | Enforce non-null on the new PK candidate | Low | No | Yes (`DROP NOT NULL`) | Statement 4 already populated every row, so this cannot fail given Phase 1 completed |
| 52 | `ALTER TABLE "Sku" ADD CONSTRAINT "Sku_pkey" PRIMARY KEY ("id");` | Re-establish the primary key | **Medium** | No | No (sequence-dependent) | **This is the statement that would catch a hash collision from statement 4** — `PRIMARY KEY` enforces uniqueness; if two rows ever produced the same generated id, this statement fails and the transaction aborts. See "Self-Validating Design" below |
| 53 | `ALTER TABLE "Sku" ALTER COLUMN "code" SET NOT NULL;` | Enforce non-null on the new code column | Low | No | Yes (`DROP NOT NULL`) | Statement 2 already populated every row from the old `id`, which was itself always non-null (it was a primary key) — cannot fail |

### Phase 6 — Re-establish constraints against the new key, including the new uniqueness rule

| # | Exact Statement | Purpose | Risk | Data Loss | Rollback | Notes |
|---|---|---|---|---|---|---|
| 54 | `ALTER TABLE "MainInventory" ADD CONSTRAINT "MainInventory_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;` | Restore referential integrity | Low | No | Yes (`DROP CONSTRAINT`) | Matches the original `ON DELETE RESTRICT ON UPDATE CASCADE` exactly — behavior is unchanged from before the migration |
| 55 | `ALTER TABLE "MainInventory" ADD CONSTRAINT "MainInventory_skuId_key" UNIQUE ("skuId");` | Restore the 1-inventory-row-per-SKU rule | Low | No | Yes | Matches `schema.prisma`'s `skuId String @unique` |
| 56 | `ALTER TABLE "EngineerStock" ADD CONSTRAINT "EngineerStock_skuId_fkey" ...;` | Restore referential integrity | Low | No | Yes | Same pattern as #54 |
| 57 | `ALTER TABLE "EngineerStock" ADD CONSTRAINT "EngineerStock_engineerId_skuId_key" UNIQUE ("engineerId", "skuId");` | Restore the 1-stock-row-per-engineer-per-SKU rule | Low | No | Yes | Matches `@@unique([engineerId, skuId])` |
| 58 | `ALTER TABLE "ProductivityItem" ADD CONSTRAINT "ProductivityItem_skuId_fkey" ...;` | Restore referential integrity | Low | No | Yes | Same pattern |
| 59 | `ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_skuId_fkey" ...;` | Restore referential integrity | Low | No | Yes | Same pattern |
| 60 | `ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_skuId_fkey" ...;` | Restore referential integrity | Low | No | Yes | Same pattern |
| 61 | `ALTER TABLE "PurchaseInward" ADD CONSTRAINT "PurchaseInward_skuId_fkey" ...;` | Restore referential integrity | Low | No | Yes | Same pattern |
| 62 | `ALTER TABLE "Sku" ADD CONSTRAINT "Sku_code_orgId_key" UNIQUE ("code", "orgId");` | **This is the actual deliverable of P0-1** — the new org-scoped uniqueness rule | Low | No | Yes | **Guaranteed to succeed**: `code` was copied verbatim from the old `id`, which was a primary key and therefore already unique across the *entire* table — a uniqueness rule on `(code, orgId)` can never be violated by data that was already unique on `code` alone. This statement cannot fail on existing data, by construction |

### Self-Validating Design (applies to statements 4, 6/8/10/12/14/16/18, 29/32/35/38/41/44/47, 52)

This migration has a useful property worth calling out explicitly: **every step that could theoretically go wrong on bad/unexpected data is positioned so that a problem surfaces as a hard transaction failure, not a silent data error.** Postgres DDL is transactional, and `prisma migrate deploy` runs each migration file inside a single transaction by default (none of the statements here require running outside a transaction, e.g. no `CREATE INDEX CONCURRENTLY`). Concretely:
- A hash collision in statement 4 would be caught by the `PRIMARY KEY` constraint in statement 52.
- A pre-existing orphaned FK (a `skuId` with no matching `Sku.id` — which should be impossible given the original FK constraints were always enforced) would leave a `NULL` in the corresponding `newSkuId` column, caught by the matching `SET NOT NULL` in Phase 4.
- If **any** statement in the file fails for any reason, Postgres rolls back the entire migration — there is no possible state where some tables are remapped and others are not.

The one exception is `RevokeRequest.skuId` (statement 18/45–47) — see Notes below.

### Notes — things to be aware of, not defects to fix

1. **`RevokeRequest.skuId` has no FK, before or after this migration.** This is a pre-existing characteristic of the schema (it's a denormalized copy used only for display/lookup in application code), not something introduced by this migration. The `SET NOT NULL` in statement 47 still catches a `NULL` remap, but it would *not* catch a remap to the *wrong* (non-null) id, since there's no foreign key to violate. Given `RevokeRequest` rows are always created from an existing `StockRequest.skuId` (itself FK-enforced) and never edited afterward, the practical risk is low — but this is the one place in the migration where "all foreign keys are remapped correctly" cannot be verified by the database itself and should be checked with an explicit query (see Pre-Deployment Checklist).
2. **Deployment ordering matters.** The application's `createSku` controller, after this sprint's code change, calls `prisma.sku.create({ data: { code: ..., name, lowStockAlert, orgId } })` — it no longer passes `id`. If this migration is deployed to a database that is still being served by the *old* backend code (which calls `create({ data: { id: skuCode, ... } })`), those old-code inserts would omit the now-required `code` field and fail with a clear `NOT NULL` violation. This fails loudly (visible 500s on SKU creation) rather than corrupting data, but it means **this migration and the corresponding backend deploy must ship together**, not the migration first with a delayed app rollout.
3. **Operational lock/traffic note.** Several `UPDATE` statements rewrite every row of tables that may be actively written to in production (e.g. `EngineerStock`, `StockRequest`). This is standard for any migration of this shape, not a flaw in the SQL, but it is recommended to run this during a low-traffic window or with application writes briefly paused, to avoid lock contention with concurrent approvals.

---

## Migration 2 — `20260624000002_purchase_inward_creator_and_invoice_guard`

**Net effect on schema.prisma:** `PurchaseInward.invoiceNo` changes from required to optional; a new `@@unique([orgId, vendor, invoiceNo])` constraint is added; a new nullable `createdById` field with an FK to `User` (`ON DELETE SET NULL`) is added. Confirmed this matches the SQL exactly.

| # | Exact Statement | Purpose | Risk | Data Loss | Rollback | Notes |
|---|---|---|---|---|---|---|
| 1 | `ALTER TABLE "PurchaseInward" ALTER COLUMN "invoiceNo" DROP NOT NULL;` | Allow genuinely-blank invoice numbers to be stored as `NULL` instead of the placeholder string `"N/A"` | Low | No | Yes (`SET NOT NULL`, but only after re-populating any new NULLs) | Purely relaxes a constraint; no existing value is touched by this statement alone |
| 2 | `UPDATE "PurchaseInward" SET "invoiceNo" = NULL WHERE "invoiceNo" = 'N/A';` | Normalize the historical placeholder so it's exempt from the new uniqueness rule | Medium | **Yes — narrow and intentional** | No (the literal string `"N/A"` is not recoverable after this runs) | **This is a real, if narrow, data transformation.** Any row where a user *genuinely typed the literal text* `"N/A"` as a real invoice number (as opposed to the system default applied when the field was left blank) loses that distinction and becomes indistinguishable from "no invoice entered." Given the only code path that ever wrote `"N/A"` was the old default (`invoiceNo: invoiceNo \|\| "N/A"` when the user submitted nothing), this is very unlikely to affect a genuine invoice number, but it is not provably zero-impact from the SQL alone |
| 3 | `WITH ranked AS (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "orgId","vendor","invoiceNo" ORDER BY "createdAt" ASC) AS rn FROM "PurchaseInward" WHERE "invoiceNo" IS NOT NULL) UPDATE "PurchaseInward" p SET "invoiceNo" = NULL FROM ranked WHERE p."id" = ranked."id" AND ranked.rn > 1;` | Defensively clear any **pre-existing accidental duplicate** `(orgId, vendor, invoiceNo)` combination so the new unique constraint can be added without the migration failing | **Medium-High** | **Yes — conditional on existing data** | No | **This is the statement requiring the most scrutiny.** If genuine duplicate `(vendor, invoiceNo)` pairs already exist in the data today — e.g. two real, distinct deliveries that happen to share a vendor and invoice number due to a past data-entry mistake, or a legitimate re-entry — only the **earliest** (`createdAt ASC`) row keeps its invoice number; every later duplicate has its `invoiceNo` set to `NULL`. **No row is deleted and no other field (qty, status, sku, vendor, date) is touched** — only the `invoiceNo` text on the "losing" duplicate(s) is cleared. If no such duplicates exist today, this statement has zero effect on the table |
| 4 | `ALTER TABLE "PurchaseInward" ADD CONSTRAINT "PurchaseInward_orgId_vendor_invoiceNo_key" UNIQUE ("orgId", "vendor", "invoiceNo");` | Deliver the actual P1-7 duplicate-invoice guard | Low | No | Yes (`DROP CONSTRAINT`) | **Guaranteed to succeed** given statement 3 ran immediately before it — by the time this runs, no two non-null `(orgId, vendor, invoiceNo)` tuples can remain. Postgres treats `NULL` as distinct from every other `NULL` in a unique index, so any number of rows with a `NULL` invoiceNo coexist without conflict |
| 5 | `ALTER TABLE "PurchaseInward" ADD COLUMN "createdById" TEXT;` | Add the field needed to notify the original submitter (P1-8) | Low | No | Yes (`DROP COLUMN`) | Nullable, additive; every existing row gets `NULL` (correctly — there is no way to retroactively know who created historical entries) |
| 6 | `ALTER TABLE "PurchaseInward" ADD CONSTRAINT "PurchaseInward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;` | Enforce that `createdById`, when set, always points at a real user | Low | No | Yes (`DROP CONSTRAINT`) | `ON DELETE SET NULL` matches Prisma's default referential action for an optional relation — deleting a user later does not block or cascade-delete their historical purchase entries, it just clears the attribution. Correct choice |

### Determinism check (explicit ask: "Constraint creation is deterministic")

The **success** of statement 4 is fully deterministic — given statement 3 runs first, there is no scenario where statement 4 fails. The only non-determinism in the whole migration is *which* row among an exact-`createdAt`-timestamp tie keeps its invoice number in statement 3 (Postgres does not guarantee a stable tie-break for `ROW_NUMBER()` over identical `ORDER BY` values without a secondary tiebreaker column). This affects *which* historical row is treated as canonical in an edge case that should be rare (two purchase entries inserted in the same database transaction or the same millisecond), not *whether* the migration succeeds.

---

## SKU Migration — Specific Verification Requested

| Requirement | Verified? | Basis |
|---|---|---|
| No records can be orphaned | **Yes, for 6 of 7 dependent tables** (FK-enforced); **not provable from the SQL alone for `RevokeRequest.skuId`** (no FK) | `SET NOT NULL` after every remap acts as a hard backstop for FK-bearing tables; `RevokeRequest` has no equivalent backstop against a *wrong* (non-null) value — see Notes above and the validation query below |
| All foreign keys are remapped correctly | Yes, for `MainInventory`, `EngineerStock`, `ProductivityItem`, `StockRequest`, `ReturnRequest`, `PurchaseInward` | Each remap is a direct join against `Sku.id` (the value that existed *before* it was dropped), not a recomputation — there is no opportunity for the join to pick the wrong row as long as `Sku.id` was unique before the migration, which it always was (it was a primary key) |
| Existing stock records remain linked | Yes | `EngineerStock` and `MainInventory` both go through the identical remap-then-reconstrain pattern; `MainInventory_skuId_key` (1 row per SKU) is reapplied, so a successful migration guarantees the 1:1 relationship is intact |
| Existing productivity records remain linked | Yes | `ProductivityItem.skuId` remap follows the same verified pattern; `ProductivityLog` itself is untouched (no `skuId` column on that table — only its child `ProductivityItem` rows reference SKUs) |
| Existing purchase inward records remain linked | Yes | `PurchaseInward.skuId` remap follows the same verified pattern |
| Existing return requests remain linked | Yes | `ReturnRequest.skuId` remap follows the same verified pattern |
| Existing revoke requests remain linked | **Conditionally** — the value is remapped using the same join logic as everywhere else, but because there's no FK on this column, a successful migration does not *prove* the link is correct the way it does for the other six tables | Run the dedicated validation query in the checklist below to confirm `RevokeRequest.skuId` values all resolve to a real `Sku.id` post-migration, since the database itself won't enforce this |

---

## Invoice Constraint Migration — Specific Verification Requested

| Requirement | Verified? | Basis |
|---|---|---|
| Existing data will not cause migration failure | Yes | The dedup step (statement 3) runs strictly before the constraint is added (statement 4), and is unconditional — it runs regardless of whether duplicates currently exist. If there are zero duplicates today, it's a no-op; if there are some, they're resolved before the constraint can see them |
| Duplicate cleanup logic is safe | **Yes, with one caveat already flagged**: it preserves every row and every field except the `invoiceNo` text on losing duplicates, which is set to `NULL` rather than deleted or guessed at | The "keep earliest by `createdAt`" rule is a defensible, deterministic default, but it is a *business* choice, not a technical one — confirm with stakeholders if any pilot org's historical data is known to contain genuine duplicate invoice numbers before relying on which one "won" |
| Constraint creation is deterministic | Yes (success is unconditional; see Determinism check above) | — |
| No valid data is removed | **Mostly, with two named exceptions, both already called out above**: (1) the literal string `"N/A"` is converted to `NULL` wherever it appears, regardless of whether it was a placeholder or a genuine (if unlikely) real invoice number; (2) on a genuine pre-existing duplicate `(orgId, vendor, invoiceNo)` set, all but the earliest row's `invoiceNo` text is cleared. No rows, quantities, statuses, vendors, dates, or SKU links are ever removed by either migration | This is the one place in the audit where "no valid data is removed" cannot be answered with an unqualified "yes" — flagged explicitly rather than glossed over |

---

## Pre-Deployment Verification Checklist

### Tables affected

| Table | Migration 1 | Migration 2 |
|---|---|---|
| `Sku` | Schema change (PK swap, new `code` column, new unique constraint) | — |
| `MainInventory` | FK remap | — |
| `EngineerStock` | FK remap | — |
| `ProductivityItem` | FK remap | — |
| `StockRequest` | FK remap | — |
| `ReturnRequest` | FK remap | — |
| `PurchaseInward` | FK remap | Column change (`invoiceNo` nullable), new unique constraint, new `createdById` column + FK |
| `RevokeRequest` | Denormalized value remap (no FK) | — |

### Expected row counts before vs. after

**For every table listed above, the row count must be IDENTICAL before and after both migrations.** Neither migration inserts or deletes a single row — only columns, constraints, and (for a bounded set of `PurchaseInward.invoiceNo` values) text content change.

```sql
-- Run BEFORE migration, save the output:
SELECT 'Sku' AS table_name, COUNT(*) FROM "Sku"
UNION ALL SELECT 'MainInventory', COUNT(*) FROM "MainInventory"
UNION ALL SELECT 'EngineerStock', COUNT(*) FROM "EngineerStock"
UNION ALL SELECT 'ProductivityItem', COUNT(*) FROM "ProductivityItem"
UNION ALL SELECT 'StockRequest', COUNT(*) FROM "StockRequest"
UNION ALL SELECT 'ReturnRequest', COUNT(*) FROM "ReturnRequest"
UNION ALL SELECT 'PurchaseInward', COUNT(*) FROM "PurchaseInward"
UNION ALL SELECT 'RevokeRequest', COUNT(*) FROM "RevokeRequest";

-- Run AFTER migration — every number must match the BEFORE run exactly.
```

Also snapshot, before migration, the full `(id, code-to-be /* current id */, orgId)` mapping for `Sku`, so the post-migration `code` values can be diffed against it:

```sql
-- Run BEFORE migration:
SELECT id, "orgId" FROM "Sku" ORDER BY id;
```

```sql
-- Run AFTER migration — every (code, orgId) pair must exactly match a
-- (id, orgId) pair from the BEFORE snapshot:
SELECT code, "orgId" FROM "Sku" ORDER BY code;
```

### Validation queries to run after migration

```sql
-- 1. No orphaned FKs in any of the 6 FK-enforced tables (should error if any
--    existed, since the FK constraint itself blocks it — this is a redundant
--    belt-and-suspenders check, expect 0 rows from each):
SELECT 'MainInventory' t, count(*) FROM "MainInventory" m
  WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = m."skuId")
UNION ALL
SELECT 'EngineerStock', count(*) FROM "EngineerStock" e
  WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = e."skuId")
UNION ALL
SELECT 'ProductivityItem', count(*) FROM "ProductivityItem" p
  WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = p."skuId")
UNION ALL
SELECT 'StockRequest', count(*) FROM "StockRequest" r
  WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = r."skuId")
UNION ALL
SELECT 'ReturnRequest', count(*) FROM "ReturnRequest" r
  WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = r."skuId")
UNION ALL
SELECT 'PurchaseInward', count(*) FROM "PurchaseInward" p
  WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = p."skuId");

-- 2. The one table with NO database-enforced FK — must be checked manually:
SELECT count(*) AS orphaned_revoke_requests FROM "RevokeRequest" rv
  WHERE NOT EXISTS (SELECT 1 FROM "Sku" s WHERE s.id = rv."skuId");
-- Expected: 0

-- 3. No duplicate SKU codes within an org (the actual P0-1 deliverable):
SELECT code, "orgId", count(*) FROM "Sku"
  GROUP BY code, "orgId" HAVING count(*) > 1;
-- Expected: 0 rows

-- 4. MainInventory still 1-row-per-SKU:
SELECT "skuId", count(*) FROM "MainInventory"
  GROUP BY "skuId" HAVING count(*) > 1;
-- Expected: 0 rows

-- 5. EngineerStock still 1-row-per-engineer-per-SKU:
SELECT "engineerId", "skuId", count(*) FROM "EngineerStock"
  GROUP BY "engineerId", "skuId" HAVING count(*) > 1;
-- Expected: 0 rows

-- 6. Spot-check that quantities were not altered, only keys remapped —
--    total engineer-held stock and total warehouse stock should each match
--    a pre-migration sum:
SELECT sum(qty) FROM "EngineerStock";   -- compare to pre-migration sum
SELECT sum(qty) FROM "MainInventory";   -- compare to pre-migration sum

-- 7. No duplicate (orgId, vendor, invoiceNo) remain, confirming migration 2's
--    constraint is doing its job and the dedup step worked:
SELECT "orgId", vendor, "invoiceNo", count(*) FROM "PurchaseInward"
  WHERE "invoiceNo" IS NOT NULL
  GROUP BY "orgId", vendor, "invoiceNo" HAVING count(*) > 1;
-- Expected: 0 rows

-- 8. Confirm no PurchaseInward rows were deleted and createdById defaulted
--    to NULL (not some other unexpected value) for historical rows:
SELECT count(*) FROM "PurchaseInward" WHERE "createdById" IS NOT NULL;
-- Expected: 0 immediately after migration (no historical row has a known
-- submitter); this number should only grow from new entries created after
-- the new backend code is live.
```

### Application-level smoke test (after migration + new backend deploy)

- Fetch `GET /skus` as a Store Manager — confirm every returned SKU has both a non-null `id` and a non-null `code`, and that `code` matches what was previously shown as the SKU's identifier.
- Create a new SKU with a code that already exists **in a different organisation** — confirm it succeeds (this is the actual P0-1 fix being exercised for the first time against real data).
- Approve one Stock Request, one Purchase Inward entry, and one Return Request — confirm inventory quantities update correctly, proving the remapped `skuId` FKs resolve correctly end-to-end through the application, not just at the database level.

---

## Final Verdict

# SAFE TO DEPLOY

**Conditional on completing the Pre-Deployment Verification Checklist above against a staging copy of the real database before this is ever run against production or pilot data.** No SQL statement in either migration requires rewriting — the logic is sound, every constraint addition is provably guaranteed to succeed given the preceding steps, and Postgres's transactional DDL means a failure at any point rolls back the entire migration with no partial-applied state.

This verdict carries three explicit conditions, none of which require changing the SQL itself:

1. **Run the checklist queries against a staging snapshot first**, not production directly — this has not yet been done in this environment (no `DATABASE_URL` was available), and is the one thing in this whole review that cannot be verified by reading SQL alone.
2. **Deploy the migration and the corresponding backend code change together** — the old backend code (pre-fix) is incompatible with the post-migration schema (see Migration 1, Notes, item 2).
3. **Confirm with whoever owns the data** that the two named, narrow data transformations in Migration 2 (literal `"N/A"` → `NULL`; losing duplicate invoice numbers → `NULL`) are acceptable — they are very unlikely to affect real data but are not zero-risk by construction, and this report does not have visibility into the actual current contents of any pilot database to rule them out definitively.
