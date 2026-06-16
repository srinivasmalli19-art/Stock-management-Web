-- Phase C Wave 2 — Migration 2
-- Makes orgId NOT NULL on 10 entities.
-- User.orgId remains nullable (Super_Admin intentionally has orgId = NULL).
-- Safe to run only after seed-default-org.js backfill returns ALL CLEAR.

ALTER TABLE "Sku"             ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "MainInventory"   ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "EngineerStock"   ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ProductivityLog" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Attendance"      ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "StockRequest"    ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "RevokeRequest"   ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "PurchaseInward"  ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "LpRequest"       ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ClaimRequest"    ALTER COLUMN "orgId" SET NOT NULL;
