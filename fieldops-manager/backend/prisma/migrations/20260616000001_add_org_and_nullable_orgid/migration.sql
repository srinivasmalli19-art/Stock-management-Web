-- Phase C Wave 1 — Migration 1
-- Creates Organisation table, adds Super_Admin to Role enum,
-- and adds nullable orgId FK to all 11 entities.
-- Safe to run against live data: no existing rows are touched,
-- all columns are nullable, enum ADD VALUE is additive.

-- ─── Organisation table ───────────────────────────────────────────────────────

CREATE TABLE "Organisation" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "siteCode"  TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organisation_siteCode_key" ON "Organisation"("siteCode");

-- ─── Super_Admin enum value ───────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE is safe in PostgreSQL 12+ inside a transaction
-- as long as the new value is NOT used in the same transaction.

ALTER TYPE "Role" ADD VALUE 'Super_Admin';

-- ─── User ─────────────────────────────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN "orgId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_orgId_idx" ON "User"("orgId");
CREATE INDEX "User_orgId_role_idx" ON "User"("orgId", "role");
CREATE INDEX "User_orgId_isActive_idx" ON "User"("orgId", "isActive");

-- ─── Sku ──────────────────────────────────────────────────────────────────────

ALTER TABLE "Sku" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sku_orgId_idx" ON "Sku"("orgId");

-- ─── MainInventory ────────────────────────────────────────────────────────────

ALTER TABLE "MainInventory" ADD COLUMN "orgId" TEXT;
ALTER TABLE "MainInventory" ADD CONSTRAINT "MainInventory_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MainInventory_orgId_idx" ON "MainInventory"("orgId");

-- ─── EngineerStock ────────────────────────────────────────────────────────────

ALTER TABLE "EngineerStock" ADD COLUMN "orgId" TEXT;
ALTER TABLE "EngineerStock" ADD CONSTRAINT "EngineerStock_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "EngineerStock_orgId_idx" ON "EngineerStock"("orgId");
CREATE INDEX "EngineerStock_orgId_engineerId_idx" ON "EngineerStock"("orgId", "engineerId");

-- ─── ProductivityLog ──────────────────────────────────────────────────────────

ALTER TABLE "ProductivityLog" ADD COLUMN "orgId" TEXT;
ALTER TABLE "ProductivityLog" ADD CONSTRAINT "ProductivityLog_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ProductivityLog_orgId_idx" ON "ProductivityLog"("orgId");
CREATE INDEX "ProductivityLog_orgId_date_idx" ON "ProductivityLog"("orgId", "date");
CREATE INDEX "ProductivityLog_orgId_status_idx" ON "ProductivityLog"("orgId", "status");

-- ─── Attendance ───────────────────────────────────────────────────────────────

ALTER TABLE "Attendance" ADD COLUMN "orgId" TEXT;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Attendance_orgId_idx" ON "Attendance"("orgId");
CREATE INDEX "Attendance_orgId_date_idx" ON "Attendance"("orgId", "date");

-- ─── StockRequest ─────────────────────────────────────────────────────────────

ALTER TABLE "StockRequest" ADD COLUMN "orgId" TEXT;
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StockRequest_orgId_idx" ON "StockRequest"("orgId");
CREATE INDEX "StockRequest_orgId_status_idx" ON "StockRequest"("orgId", "status");

-- ─── RevokeRequest ────────────────────────────────────────────────────────────

ALTER TABLE "RevokeRequest" ADD COLUMN "orgId" TEXT;
ALTER TABLE "RevokeRequest" ADD CONSTRAINT "RevokeRequest_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "RevokeRequest_orgId_idx" ON "RevokeRequest"("orgId");
CREATE INDEX "RevokeRequest_orgId_status_idx" ON "RevokeRequest"("orgId", "status");

-- ─── PurchaseInward ───────────────────────────────────────────────────────────

ALTER TABLE "PurchaseInward" ADD COLUMN "orgId" TEXT;
ALTER TABLE "PurchaseInward" ADD CONSTRAINT "PurchaseInward_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "PurchaseInward_orgId_idx" ON "PurchaseInward"("orgId");
CREATE INDEX "PurchaseInward_orgId_status_idx" ON "PurchaseInward"("orgId", "status");

-- ─── LpRequest ────────────────────────────────────────────────────────────────

ALTER TABLE "LpRequest" ADD COLUMN "orgId" TEXT;
ALTER TABLE "LpRequest" ADD CONSTRAINT "LpRequest_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "LpRequest_orgId_idx" ON "LpRequest"("orgId");
CREATE INDEX "LpRequest_orgId_status_idx" ON "LpRequest"("orgId", "status");

-- ─── ClaimRequest ─────────────────────────────────────────────────────────────

ALTER TABLE "ClaimRequest" ADD COLUMN "orgId" TEXT;
ALTER TABLE "ClaimRequest" ADD CONSTRAINT "ClaimRequest_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ClaimRequest_orgId_idx" ON "ClaimRequest"("orgId");
CREATE INDEX "ClaimRequest_orgId_status_idx" ON "ClaimRequest"("orgId", "status");
