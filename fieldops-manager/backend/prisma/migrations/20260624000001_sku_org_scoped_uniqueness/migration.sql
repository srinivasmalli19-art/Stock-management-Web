-- Pilot Blocker Fix (P0-1): SKU codes must be unique per-organisation, not
-- globally. Previously Sku.id WAS the human-entered code (e.g. "PART-001"),
-- used directly as the global primary key — so two different organisations
-- could never both register the same code.
--
-- Strategy: decouple the internal primary key (now a generated opaque id)
-- from the human-entered code. Every existing row is preserved — the old
-- code value is copied into the new `code` column, and every foreign key
-- that pointed at the old Sku.id is remapped to the new internal id before
-- the old id column is dropped. No data is lost.

-- 1. Stash the current human-entered code, then generate a new internal id
ALTER TABLE "Sku" ADD COLUMN "code" TEXT;
UPDATE "Sku" SET "code" = "id";

ALTER TABLE "Sku" ADD COLUMN "newId" TEXT;
UPDATE "Sku" SET "newId" = 'sku_' || substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 24);

-- 2. Remap every table that stores a Sku reference to the new internal id
ALTER TABLE "MainInventory" ADD COLUMN "newSkuId" TEXT;
UPDATE "MainInventory" m SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = m."skuId";

ALTER TABLE "EngineerStock" ADD COLUMN "newSkuId" TEXT;
UPDATE "EngineerStock" e SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = e."skuId";

ALTER TABLE "ProductivityItem" ADD COLUMN "newSkuId" TEXT;
UPDATE "ProductivityItem" p SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = p."skuId";

ALTER TABLE "StockRequest" ADD COLUMN "newSkuId" TEXT;
UPDATE "StockRequest" r SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = r."skuId";

ALTER TABLE "ReturnRequest" ADD COLUMN "newSkuId" TEXT;
UPDATE "ReturnRequest" r SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = r."skuId";

ALTER TABLE "PurchaseInward" ADD COLUMN "newSkuId" TEXT;
UPDATE "PurchaseInward" p SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = p."skuId";

-- RevokeRequest.skuId is a denormalized copy with no FK constraint, but
-- application code still joins on it — remap it too for consistency.
ALTER TABLE "RevokeRequest" ADD COLUMN "newSkuId" TEXT;
UPDATE "RevokeRequest" r SET "newSkuId" = s."newId" FROM "Sku" s WHERE s."id" = r."skuId";

-- 3. Drop old FK/unique constraints that reference the soon-to-be-replaced Sku.id
ALTER TABLE "MainInventory" DROP CONSTRAINT "MainInventory_skuId_fkey";
ALTER TABLE "MainInventory" DROP CONSTRAINT "MainInventory_skuId_key";
ALTER TABLE "EngineerStock" DROP CONSTRAINT "EngineerStock_skuId_fkey";
ALTER TABLE "EngineerStock" DROP CONSTRAINT "EngineerStock_engineerId_skuId_key";
ALTER TABLE "ProductivityItem" DROP CONSTRAINT "ProductivityItem_skuId_fkey";
ALTER TABLE "StockRequest" DROP CONSTRAINT "StockRequest_skuId_fkey";
ALTER TABLE "ReturnRequest" DROP CONSTRAINT "ReturnRequest_skuId_fkey";
ALTER TABLE "PurchaseInward" DROP CONSTRAINT "PurchaseInward_skuId_fkey";

-- 4. Swap old/new skuId columns on every dependent table
ALTER TABLE "MainInventory" DROP COLUMN "skuId";
ALTER TABLE "MainInventory" RENAME COLUMN "newSkuId" TO "skuId";
ALTER TABLE "MainInventory" ALTER COLUMN "skuId" SET NOT NULL;

ALTER TABLE "EngineerStock" DROP COLUMN "skuId";
ALTER TABLE "EngineerStock" RENAME COLUMN "newSkuId" TO "skuId";
ALTER TABLE "EngineerStock" ALTER COLUMN "skuId" SET NOT NULL;

ALTER TABLE "ProductivityItem" DROP COLUMN "skuId";
ALTER TABLE "ProductivityItem" RENAME COLUMN "newSkuId" TO "skuId";
ALTER TABLE "ProductivityItem" ALTER COLUMN "skuId" SET NOT NULL;

ALTER TABLE "StockRequest" DROP COLUMN "skuId";
ALTER TABLE "StockRequest" RENAME COLUMN "newSkuId" TO "skuId";
ALTER TABLE "StockRequest" ALTER COLUMN "skuId" SET NOT NULL;

ALTER TABLE "ReturnRequest" DROP COLUMN "skuId";
ALTER TABLE "ReturnRequest" RENAME COLUMN "newSkuId" TO "skuId";
ALTER TABLE "ReturnRequest" ALTER COLUMN "skuId" SET NOT NULL;

ALTER TABLE "PurchaseInward" DROP COLUMN "skuId";
ALTER TABLE "PurchaseInward" RENAME COLUMN "newSkuId" TO "skuId";
ALTER TABLE "PurchaseInward" ALTER COLUMN "skuId" SET NOT NULL;

ALTER TABLE "RevokeRequest" DROP COLUMN "skuId";
ALTER TABLE "RevokeRequest" RENAME COLUMN "newSkuId" TO "skuId";
ALTER TABLE "RevokeRequest" ALTER COLUMN "skuId" SET NOT NULL;

-- 5. Swap Sku's primary key from the old code-as-id to the new generated id
ALTER TABLE "Sku" DROP CONSTRAINT "Sku_pkey";
ALTER TABLE "Sku" DROP COLUMN "id";
ALTER TABLE "Sku" RENAME COLUMN "newId" TO "id";
ALTER TABLE "Sku" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_pkey" PRIMARY KEY ("id");
ALTER TABLE "Sku" ALTER COLUMN "code" SET NOT NULL;

-- 6. Re-establish FKs/unique constraints against the new Sku.id, and add the
--    org-scoped uniqueness on (code, orgId) that this fix exists to deliver.
ALTER TABLE "MainInventory" ADD CONSTRAINT "MainInventory_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MainInventory" ADD CONSTRAINT "MainInventory_skuId_key" UNIQUE ("skuId");

ALTER TABLE "EngineerStock" ADD CONSTRAINT "EngineerStock_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EngineerStock" ADD CONSTRAINT "EngineerStock_engineerId_skuId_key" UNIQUE ("engineerId", "skuId");

ALTER TABLE "ProductivityItem" ADD CONSTRAINT "ProductivityItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseInward" ADD CONSTRAINT "PurchaseInward_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sku" ADD CONSTRAINT "Sku_code_orgId_key" UNIQUE ("code", "orgId");
