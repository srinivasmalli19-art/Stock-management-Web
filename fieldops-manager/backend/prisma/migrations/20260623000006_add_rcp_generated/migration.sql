-- AlterTable: add rcpGenerated to ProductivityLog
ALTER TABLE "ProductivityLog" ADD COLUMN "rcpGenerated" INTEGER NOT NULL DEFAULT 0;
