-- Add engineerEmail to LpRequest to support Engineer-initiated LP workflow
-- Nullable: existing TL-created records will have NULL (backward compatible)
ALTER TABLE "LpRequest" ADD COLUMN "engineerEmail" TEXT;
