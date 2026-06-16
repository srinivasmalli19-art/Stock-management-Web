const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

const buildWhere = (req) => {
  const { engineerId, month, status } = req.query;
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;

  if (req.user.role === "Engineer") {
    where.engineerId = req.user.id;
  } else if (engineerId) {
    where.engineerId = engineerId;
  }

  if (month) {
    const [year, mo] = month.split("-");
    const start = new Date(`${year}-${mo}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    where.date = { gte: start, lt: end };
  }

  if (status) where.status = status;

  return where;
};

const getLogs = asyncHandler(async (req, res) => {
  const where = buildWhere(req);
  const logs = await prisma.productivityLog.findMany({
    where,
    include: {
      engineer: { select: { id: true, name: true, email: true } },
      items: { include: { sku: { select: { id: true, name: true } } } },
    },
    orderBy: { date: "desc" },
  });
  return success(res, logs);
});

const createLog = asyncHandler(async (req, res) => {
  const { date, callsClosed, items = [] } = req.body;
  const engineerId = req.user.id;
  const orgId = req.user.orgId;

  const logDate = new Date(date);

  const existing = await prisma.productivityLog.findUnique({
    where: { engineerId_date: { engineerId, date: logDate } },
  });
  if (existing) return error(res, "A productivity log for this date already exists", 409);

  const log = await prisma.productivityLog.create({
    data: {
      engineerId,
      orgId,
      date: logDate,
      callsClosed: callsClosed || 0,
      status: "Pending",
      items: {
        create: items.map((item) => ({
          skuId: item.skuId,
          qty: item.qty,
          saleValue: item.saleValue || 0,
        })),
      },
    },
    include: { items: true },
  });

  return created(res, log, "Productivity log submitted for validation");
});

const validateLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tlNote } = req.body;

  const log = await prisma.productivityLog.findUnique({ where: { id } });
  if (!log) return error(res, "Log not found", 404);
  if (req.user.role !== "Super_Admin" && log.orgId !== req.user.orgId) return error(res, "Log not found", 404);
  if (log.status !== "Pending") return error(res, "Only Pending logs can be validated", 400);

  const updated = await prisma.productivityLog.update({
    where: { id },
    data: { status: "Validated", tlNote: tlNote || "" },
  });

  return success(res, updated, "Log validated");
});

const rejectTL = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tlNote } = req.body;

  const log = await prisma.productivityLog.findUnique({ where: { id } });
  if (!log) return error(res, "Log not found", 404);
  if (req.user.role !== "Super_Admin" && log.orgId !== req.user.orgId) return error(res, "Log not found", 404);
  if (log.status !== "Pending") return error(res, "Only Pending logs can be rejected by TL", 400);

  const updated = await prisma.productivityLog.update({
    where: { id },
    data: { status: "Rejected", tlNote: tlNote || "" },
  });

  return success(res, updated, "Log rejected");
});

const approveLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { items = [], adminNote } = req.body;

  const log = await prisma.productivityLog.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!log) return error(res, "Log not found", 404);
  if (req.user.role !== "Super_Admin" && log.orgId !== req.user.orgId) return error(res, "Log not found", 404);
  if (log.status !== "Validated") return error(res, "Only Validated logs can be approved", 400);

  await prisma.$transaction(async (tx) => {
    for (const itemUpdate of items) {
      await tx.productivityItem.update({
        where: { id: itemUpdate.id },
        data: { adminIncentive: itemUpdate.adminIncentive ?? 0 },
      });
    }

    await tx.productivityLog.update({
      where: { id },
      data: { status: "Approved", adminNote: adminNote || "" },
    });

    await tx.attendance.upsert({
      where: { engineerId_date: { engineerId: log.engineerId, date: log.date } },
      update: { status: "Present" },
      create: {
        engineerId: log.engineerId,
        date: log.date,
        status: "Present",
        productivityLogId: log.id,
        orgId: log.orgId,
      },
    });

    for (const item of log.items) {
      const existing = await tx.engineerStock.findUnique({
        where: { engineerId_skuId: { engineerId: log.engineerId, skuId: item.skuId } },
      });
      if (existing) {
        await tx.engineerStock.update({
          where: { engineerId_skuId: { engineerId: log.engineerId, skuId: item.skuId } },
          data: { qty: Math.max(0, existing.qty - item.qty) },
        });
      }
    }
  });

  const totalIncentive = items.reduce((s, i) => s + (i.adminIncentive || 0), 0);
  return success(res, {}, `Approved! ₹${totalIncentive.toLocaleString("en-IN")} incentive saved. Attendance marked Present.`);
});

const rejectAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminNote } = req.body;

  const log = await prisma.productivityLog.findUnique({ where: { id } });
  if (!log) return error(res, "Log not found", 404);
  if (req.user.role !== "Super_Admin" && log.orgId !== req.user.orgId) return error(res, "Log not found", 404);
  if (log.status !== "Validated") return error(res, "Only Validated logs can be rejected by Admin", 400);

  const updated = await prisma.productivityLog.update({
    where: { id },
    data: { status: "Rejected", adminNote: adminNote || "" },
  });

  return success(res, updated, "Log rejected");
});

module.exports = { getLogs, createLog, validateLog, rejectTL, approveLog, rejectAdmin };
