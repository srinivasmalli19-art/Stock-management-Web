-- CreateTable StaffAttendance (TL/SM self-attendance with admin approval workflow)
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "attendanceStatus" TEXT NOT NULL DEFAULT 'Present',
    "remarks" TEXT,
    "submissionStatus" TEXT NOT NULL DEFAULT 'Pending',
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable AttendanceLedger (approved records only)
CREATE TABLE "AttendanceLedger" (
    "id" TEXT NOT NULL,
    "staffAttendanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "attendanceStatus" TEXT NOT NULL,
    "remarks" TEXT,
    "approvedById" TEXT NOT NULL,
    "approvedByName" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex StaffAttendance
CREATE UNIQUE INDEX "StaffAttendance_userId_date_key" ON "StaffAttendance"("userId", "date");
CREATE INDEX "StaffAttendance_orgId_idx" ON "StaffAttendance"("orgId");
CREATE INDEX "StaffAttendance_orgId_submissionStatus_idx" ON "StaffAttendance"("orgId", "submissionStatus");
CREATE INDEX "StaffAttendance_userId_idx" ON "StaffAttendance"("userId");

-- CreateIndex AttendanceLedger
CREATE UNIQUE INDEX "AttendanceLedger_staffAttendanceId_key" ON "AttendanceLedger"("staffAttendanceId");
CREATE INDEX "AttendanceLedger_orgId_idx" ON "AttendanceLedger"("orgId");
CREATE INDEX "AttendanceLedger_orgId_date_idx" ON "AttendanceLedger"("orgId", "date");
CREATE INDEX "AttendanceLedger_userId_idx" ON "AttendanceLedger"("userId");
CREATE INDEX "AttendanceLedger_orgId_userId_idx" ON "AttendanceLedger"("orgId", "userId");

-- AddForeignKey StaffAttendance
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey AttendanceLedger
ALTER TABLE "AttendanceLedger" ADD CONSTRAINT "AttendanceLedger_staffAttendanceId_fkey"
    FOREIGN KEY ("staffAttendanceId") REFERENCES "StaffAttendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceLedger" ADD CONSTRAINT "AttendanceLedger_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
