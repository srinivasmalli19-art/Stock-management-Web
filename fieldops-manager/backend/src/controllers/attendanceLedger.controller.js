const prisma = require("../config/db");
const { success } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { Parser } = require("json2csv");

const buildWhere = (req) => {
  const { userId, orgId: filterOrgId, status, from, to } = req.query;
  const where = {};

  if (req.user.role !== "Super_Admin") {
    where.orgId = req.user.orgId;
  } else if (filterOrgId) {
    where.orgId = filterOrgId;
  }

  if (userId) where.userId = userId;
  if (status) where.attendanceStatus = status;

  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  return where;
};

// GET /api/attendance-ledger
const getLedger = asyncHandler(async (req, res) => {
  const where = buildWhere(req);

  const records = await prisma.attendanceLedger.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return success(res, records);
});

// GET /api/attendance-ledger/csv
const downloadLedgerCsv = asyncHandler(async (req, res) => {
  const where = buildWhere(req);

  const records = await prisma.attendanceLedger.findMany({
    where,
    orderBy: { date: "desc" },
  });

  const fields = [
    { label: "Date", value: (r) => r.date.toISOString().split("T")[0] },
    { label: "User Name", value: "userName" },
    { label: "Role", value: "role" },
    { label: "Attendance Status", value: "attendanceStatus" },
    { label: "Remarks", value: (r) => r.remarks || "" },
    { label: "Approved By", value: "approvedByName" },
    { label: "Approved At", value: (r) => r.approvedAt.toISOString().replace("T", " ").substring(0, 16) },
  ];

  const today = new Date().toISOString().split("T")[0];
  const parser = new Parser({ fields });
  const csv = records.length > 0 ? parser.parse(records) : fields.map((f) => f.label).join(",");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="attendance_ledger_${today}.csv"`);
  res.send(csv);
});

module.exports = { getLedger, downloadLedgerCsv };
