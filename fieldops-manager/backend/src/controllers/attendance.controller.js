const prisma = require("../config/db");
const { success, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { Parser } = require("json2csv");

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

const getAttendanceSummary = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const engWhere = { role: "Engineer", isActive: true };
  if (req.user.role !== "Super_Admin") engWhere.orgId = req.user.orgId;

  const engineers = await prisma.user.findMany({ where: engWhere, orderBy: { name: "asc" } });

  const monthStr = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [year, mo] = monthStr.split("-");
  const start = new Date(`${year}-${mo}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const daysInMonth = new Date(parseInt(year), parseInt(mo), 0).getDate();
  const today = new Date();
  const workingDays = start.getMonth() === today.getMonth() && start.getFullYear() === today.getFullYear()
    ? today.getDate()
    : daysInMonth;

  const summary = await Promise.all(
    engineers.map(async (eng) => {
      const attendance = await prisma.attendance.findMany({
        where: { engineerId: eng.id, date: { gte: start, lt: end } },
      });
      const daysPresent = attendance.filter((a) => a.status === "Present").length;

      const logs = await prisma.productivityLog.findMany({
        where: { engineerId: eng.id, status: "Approved", date: { gte: start, lt: end } },
        include: { items: true },
      });

      const callsClosed = logs.reduce((s, l) => s + l.callsClosed, 0);
      const revenue = logs.reduce((s, l) => s + l.items.reduce((si, i) => si + i.saleValue, 0), 0);
      const incentive = logs.reduce((s, l) => s + l.items.reduce((si, i) => si + (i.adminIncentive || 0), 0), 0);

      return {
        engineerId: eng.id,
        name: eng.name,
        email: eng.email,
        daysPresent,
        daysAbsent: Math.max(0, workingDays - daysPresent),
        callsClosed,
        revenue,
        incentive,
      };
    })
  );

  return success(res, summary);
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

module.exports = { getAttendance, getAttendanceSummary, downloadAttendanceCsv };
