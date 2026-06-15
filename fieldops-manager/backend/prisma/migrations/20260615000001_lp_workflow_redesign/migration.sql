-- LP Workflow Redesign Migration
-- Removes engineer-initiated LP flow, adds TL→Admin→TL→Store→Admin pipeline
-- Adds separate ClaimRequest table

-- Step 1: Remove engineer column (added in wrong previous implementation)
ALTER TABLE "LpRequest" DROP COLUMN IF EXISTS "engineerEmail";

-- Step 2: Rename date → requestDate
ALTER TABLE "LpRequest" RENAME COLUMN "date" TO "requestDate";

-- Step 3a: Drop the enum DEFAULT before type conversion
-- (PostgreSQL cannot auto-cast a typed enum default to TEXT)
ALTER TABLE "LpRequest" ALTER COLUMN "status" DROP DEFAULT;

-- Step 3b: Convert status enum column to TEXT (preserving data)
ALTER TABLE "LpRequest" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

-- Step 4: Drop the old LpStatus enum type (now safe — no column references it)
DROP TYPE IF EXISTS "LpStatus";

-- Step 5: Normalise old status values → new status strings
UPDATE "LpRequest" SET "status" = 'LP_PENDING_ADMIN_APPROVAL' WHERE "status" = 'Pending';
UPDATE "LpRequest" SET "status" = 'CLAIM_PENDING'             WHERE "status" IN ('Claim_Pending', 'Claim_Submitted', 'Claim_Forwarded');
UPDATE "LpRequest" SET "status" = 'CLAIM_APPROVED'            WHERE "status" = 'Claim_Approved';
UPDATE "LpRequest" SET "status" = 'LP_REJECTED'               WHERE "status" = 'Rejected';

-- Step 6: Set new default for status
ALTER TABLE "LpRequest" ALTER COLUMN "status" SET DEFAULT 'LP_PENDING_ADMIN_APPROVAL';

-- Step 7: Add new columns to LpRequest
ALTER TABLE "LpRequest" ADD COLUMN IF NOT EXISTS "requestId"    TEXT;
ALTER TABLE "LpRequest" ADD COLUMN IF NOT EXISTS "description"  TEXT NOT NULL DEFAULT '';
ALTER TABLE "LpRequest" ADD COLUMN IF NOT EXISTS "totalCost"    DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LpRequest" ADD COLUMN IF NOT EXISTS "adminRemarks" TEXT;
ALTER TABLE "LpRequest" ADD COLUMN IF NOT EXISTS "approvedBy"   TEXT;
ALTER TABLE "LpRequest" ADD COLUMN IF NOT EXISTS "approvedAt"   TIMESTAMP(3);

-- Step 8: Backfill requestId for existing records
UPDATE "LpRequest"
SET "requestId" = 'LP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING("id" FROM 1 FOR 6))
WHERE "requestId" IS NULL;

-- Step 9: Make requestId NOT NULL and UNIQUE after backfill
ALTER TABLE "LpRequest" ALTER COLUMN "requestId" SET NOT NULL;
ALTER TABLE "LpRequest" ADD CONSTRAINT "LpRequest_requestId_key" UNIQUE ("requestId");

-- Step 10: Backfill totalCost from existing spareCost + serviceCost
UPDATE "LpRequest" SET "totalCost" = "spareCost" + "serviceCost";

-- Step 11: Create ClaimRequest table
CREATE TABLE IF NOT EXISTS "ClaimRequest" (
    "id"                TEXT NOT NULL,
    "lpRequestId"       TEXT NOT NULL,
    "claimAmount"       DOUBLE PRECISION NOT NULL,
    "remarks"           TEXT NOT NULL,
    "status"            TEXT NOT NULL DEFAULT 'CLAIM_VALIDATION_PENDING',
    "validatedBy"       TEXT,
    "validatedAt"       TIMESTAMP(3),
    "validationRemarks" TEXT,
    "approvedBy"        TEXT,
    "approvedAt"        TIMESTAMP(3),
    "approvalRemarks"   TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimRequest_pkey" PRIMARY KEY ("id")
);

-- Step 12: One claim per LP request
ALTER TABLE "ClaimRequest"
    ADD CONSTRAINT "ClaimRequest_lpRequestId_key" UNIQUE ("lpRequestId");

-- Step 13: Foreign key LP → Claim
ALTER TABLE "ClaimRequest"
    ADD CONSTRAINT "ClaimRequest_lpRequestId_fkey"
    FOREIGN KEY ("lpRequestId") REFERENCES "LpRequest"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
