-- Pilot Blocker Fix (P1-7 / P1-8): duplicate-invoice protection and a
-- known submitter so Purchase Inward approve/reject can notify them.

-- 1. invoiceNo becomes nullable rather than defaulting to the placeholder
--    "N/A" — NULLs are exempt from the uniqueness check below, so entries
--    genuinely submitted without an invoice number never collide with
--    each other.
ALTER TABLE "PurchaseInward" ALTER COLUMN "invoiceNo" DROP NOT NULL;
UPDATE "PurchaseInward" SET "invoiceNo" = NULL WHERE "invoiceNo" = 'N/A';

-- 2. Defensively null out any pre-existing accidental duplicate
--    (orgId, vendor, invoiceNo) combinations — keeping the earliest row's
--    value — so the new unique constraint can be added without failing on
--    historical data that predates this guard.
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "orgId", "vendor", "invoiceNo"
           ORDER BY "createdAt" ASC
         ) AS rn
  FROM "PurchaseInward"
  WHERE "invoiceNo" IS NOT NULL
)
UPDATE "PurchaseInward" p
SET "invoiceNo" = NULL
FROM ranked
WHERE p."id" = ranked."id" AND ranked.rn > 1;

ALTER TABLE "PurchaseInward" ADD CONSTRAINT "PurchaseInward_orgId_vendor_invoiceNo_key" UNIQUE ("orgId", "vendor", "invoiceNo");

-- 3. Track who submitted each entry so approve/reject can notify them.
--    Nullable because historical rows have no recorded submitter.
ALTER TABLE "PurchaseInward" ADD COLUMN "createdById" TEXT;
ALTER TABLE "PurchaseInward" ADD CONSTRAINT "PurchaseInward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
