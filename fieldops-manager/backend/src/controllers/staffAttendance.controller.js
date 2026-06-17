const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");

const VALID_STATUSES = ["Present", "Absent", "Half_Day", "Leave"];

// TL / SM: submit own attendance
const submitAttendance = asyncHandler(async (req, res) => {
  const { date, attendanceStatus, remarks } = req.body;
  const { id: userId, name, role, orgId } = req.user;

  if (!VALID_STATUSES.includes(attendanceStatus)) {
    return error(res, "Invalid attendance status", 400);
  }

  const dateStr = date || new Date().toISOString().split("T")[0];
  const dateVal = new Date(dateStr); // YYYY-MM-DD parsed as UTC midnight — consistent with Prisma @db.Date

  const existing = await prisma.staffAttendance.findUnique({
    where: { userId_date: { userId, date: dateVal } },
  });
  if (existing) {
    return error(res, "Attendance already submitted for this date", 409);
  }

  const record = await prisma.staffAttendance.create({
    data: {
      userId,
      date: dateVal,
      attendanceStatus,
      remarks: remarks || null,
      submissionStatus: "Pending",
      orgId,
    },
  });

  await writeAudit({ req, action: "ATTENDANCE_SUBMITTED", entityType: "StaffAttendance", entityId: record.id, newValue: { date: dateStr, attendanceStatus } });

  return created(res, record, "Attendance submitted for approval");
});

// TL / SM: view own submission history
const getMyAttendance = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const where = { userId: req.user.id };

  if (month) {
    const [year, mo] = month.split("-");
    const start = new Date(`${year}-${mo}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    where.date = { gte: start, lt: end };
  }

  const records = await prisma.staffAttendance.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return success(res, records);
});

// Admin: list all submissions with optional status/userId/month filters
const getAllStaffAttendance = asyncHandler(async (req, res) => {
  const { status, userId, month } = req.query;
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;
  if (status) where.submissionStatus = status;
  if (userId) where.userId = userId;
  if (month) {
    const [year, mo] = month.split("-");
    const start = new Date(`${year}-${mo}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    where.date = { gte: start, lt: end };
  }

  const records = await prisma.staffAttendance.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return success(res, records);
});

// Admin: approve → create ledger entry atomically
const approveAttendance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { id: adminId, name: adminName, orgId: adminOrgId, role: adminRole } = req.user;

  const record = await prisma.staffAttendance.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  if (!record) return error(res, "Attendance record not found", 404);
  if (adminRole !== "Super_Admin" && record.orgId !== adminOrgId)
    return error(res, "Attendance record not found", 404);
  if (record.submissionStatus !== "Pending")
    return error(res, `Cannot approve — record is already ${record.submissionStatus}`, 400);

  const now = new Date();

  const [updated] = await prisma.$transaction([
    prisma.staffAttendance.update({
      where: { id },
      data: {
        submissionStatus: "Approved",
        approvedById: adminId,
        approvedByName: adminName,
        approvedAt: now,
      },
    }),
    prisma.attendanceLedger.create({
      data: {
        staffAttendanceId: id,
        userId: record.userId,
        userName: record.user.name,
        role: record.user.role,
        orgId: record.orgId,
        date: record.date,
        attendanceStatus: record.attendanceStatus,
        remarks: record.remarks,
        approvedById: adminId,
        approvedByName: adminName,
        approvedAt: now,
      },
    }),
  ]);

  await writeAudit({ req, action: "ATTENDANCE_APPROVED", entityType: "StaffAttendance", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Approved", userId: record.userId, date: record.date.toISOString().split("T")[0] } });

  return success(res, updated, "Attendance approved — ledger entry created");
});

// Admin: reject → no ledger entry created
const rejectAttendance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectedReason } = req.body;
  const { id: adminId, name: adminName, orgId: adminOrgId, role: adminRole } = req.user;

  const record = await prisma.staffAttendance.findUnique({ where: { id } });
  if (!record) return error(res, "Attendance record not found", 404);
  if (adminRole !== "Super_Admin" && record.orgId !== adminOrgId)
    return error(res, "Attendance record not found", 404);
  if (record.submissionStatus !== "Pending")
    return error(res, `Cannot reject — record is already ${record.submissionStatus}`, 400);

  const updated = await prisma.staffAttendance.update({
    where: { id },
    data: {
      submissionStatus: "Rejected",
      approvedById: adminId,
      approvedByName: adminName,
      approvedAt: new Date(),
      rejectedReason: rejectedReason || null,
    },
  });

  await writeAudit({ req, action: "ATTENDANCE_REJECTED", entityType: "StaffAttendance", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Rejected", userId: record.userId, rejectedReason: rejectedReason || null } });

  return success(res, updated, "Attendance rejected");
});

module.exports = {
  submitAttendance,
  getMyAttendance,
  getAllStaffAttendance,
  approveAttendance,
  rejectAttendance,
};
