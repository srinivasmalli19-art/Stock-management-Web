const prisma = require("../config/db");
const { success, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { Parser } = require("json2csv");

// Engineer attendance from Attendance table
const getAttendance = asyncHandler(async (req, res) => {
  const { month, engineerId } = req.query;
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;
  if (engineerId) where.engineerId = engineerId;
  if (month) {
    const [year, mo] = month.split("-");
    const start = new Date(`${year}-${mo}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    where.date = { gte: start, lt: end };
  }

  const records = await prisma.attendance.findMany({
    where,
    include: { engineer: { select: { id: true, name: true, email: true } } },
    orderBy: [{ date: "asc" }],
  });

  return success(res, records);
});

// Combined attendance for Admin: Engineers (Attendance table) + TL/SM (StaffAttendance table)
// Returns { engineers: [...], staff: [...] } for grid consumption
const getAttendanceAll = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const orgId = req.user.orgId;

  const monthStr = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [year, mo] = monthStr.split("-");
  const start = new Date(`${year}-${mo}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const [engineers, staff] = await Promise.all([
    // Engineer attendance from Attendance table
    prisma.attendance.findMany({
      where: { orgId, date: { gte: start, lt: end } },
      include: { engineer: { select: { id: true, name: true, role: true } } },
      orderBy: { date: "asc" },
    }),
    // TL + SM from StaffAttendance (all records, not just approved)
    prisma.staffAttendance.findMany({
      where: {
        orgId,
        date: { gte: start, lt: end },
        user: { role: { in: ["Team_Leader", "Store_Manager"] } },
      },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  return success(res, { engineers, staff });
});

// Summary: Engineer rows from Attendance + TL/SM from StaffAttendance
// Admin gets all roles; TL gets engineers only (preserves existing TL behavior)
const getAttendanceSummary = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const isAdmin = req.user.role === "Admin" || req.user.role === "Super_Admin";
  const orgId = req.user.orgId;

  const monthStr = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [year, mo] = monthStr.split("-");
  const start = new Date(`${year}-${mo}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const daysInMonth = new Date(parseInt(year), parseInt(mo), 0).getDate();
  const today = new Date();
  const workingDays =
    start.getMonth() === today.getMonth() && start.getFullYear() === today.getFullYear()
      ? today.getDate()
      : daysInMonth;

  // Always include engineers
  const engWhere = { role: "Engineer", isActive: true };
  if (req.user.role !== "Super_Admin") engWhere.orgId = orgId;

  const engineers = await prisma.user.findMany({ where: engWhere, orderBy: { name: "asc" } });

  const engRows = await Promise.all(
    engineers.map(async (eng) => {
      const attendance = await prisma.attendance.findMany({
        where: { engineerId: eng.id, date: { gte: start, lt: end } },
      });
      const daysPresent = attendance.filter((a) => a.status === "Present").length;
      return {
        userId: eng.id,
        name: eng.name,
        role: "Engineer",
        daysPresent,
        daysAbsent: Math.max(0, workingDays - daysPresent),
      };
    })
  );

  // If Admin, also include TL and SM from StaffAttendance
  let staffRows = [];
  if (isAdmin && orgId) {
    const staffUsers = await prisma.user.findMany({
      where: { orgId, role: { in: ["Team_Leader", "Store_Manager"] }, isActive: true },
      orderBy: { name: "asc" },
    });

    staffRows = await Promise.all(
      staffUsers.map(async (u) => {
        const att = await prisma.staffAttendance.findMany({
          where: {
            userId: u.id,
            date: { gte: start, lt: end },
            submissionStatus: "Approved",
            attendanceStatus: "Present",
          },
        });
        const daysPresent = att.length;
        return {
          userId: u.id,
          name: u.name,
          role: u.role,
          daysPresent,
          daysAbsent: Math.max(0, workingDays - daysPresent),
        };
      })
    );
  }

  return success(res, [...engRows, ...staffRows]);
});

const downloadAttendanceCsv = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const monthStr = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [year, mo] = monthStr.split("-");
  const start = new Date(`${year}-${mo}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const daysInMonth = new Date(parseInt(year), parseInt(mo), 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) =>
    `${year}-${mo}-${String(i + 1).padStart(2, "0")}`
  );

  const engWhere = { role: "Engineer", isActive: true };
  if (req.user.role !== "Super_Admin") engWhere.orgId = req.user.orgId;

  const engineers = await prisma.user.findMany({ where: engWhere, orderBy: { name: "asc" } });

  const rows = await Promise.all(
    engineers.map(async (eng) => {
      const att = await prisma.attendance.findMany({
        where: { engineerId: eng.id, date: { gte: start, lt: end } },
      });
      const attMap = {};
      att.forEach((a) => {
        const key = a.date.toISOString().split("T")[0];
        attMap[key] = a.status === "Present" ? "P" : "A";
      });

      const row = { Engineer: eng.name };
      let total = 0;
      days.forEach((d) => {
        const dayNum = d.split("-")[2];
        const val = attMap[d] || (new Date(d) <= new Date() ? "A" : "-");
        row[dayNum] = val;
        if (val === "P") total++;
      });
      row["Total Present"] = total;
      return row;
    })
  );

  const fields = ["Engineer", ...days.map((d) => d.split("-")[2]), "Total Present"];
  const parser = new Parser({ fields });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="attendance_${monthStr}.csv"`);
  res.send(csv);
});

module.exports = { getAttendance, getAttendanceSummary, getAttendanceAll, downloadAttendanceCsv };
