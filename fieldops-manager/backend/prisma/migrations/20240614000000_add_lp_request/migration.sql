-- CreateEnum
CREATE TYPE "LpStatus" AS ENUM ('Pending', 'Claim_Pending', 'Claim_Submitted', 'Claim_Forwarded', 'Claim_Approved', 'Rejected');

-- CreateTable
CREATE TABLE "LpRequest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "spareCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serviceCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tlEmail" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "LpStatus" NOT NULL DEFAULT 'Pending',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LpRequest_pkey" PRIMARY KEY ("id")
);
