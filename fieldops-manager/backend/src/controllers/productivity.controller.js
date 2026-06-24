const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");
const { writeNotification, roleUserIds } = require("../utils/notificationService");

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
      items: { include: { sku: { select: { id: true, code: true, name: true } } } },
    },
    orderBy: { date: "desc" },
  });
  return success(res, logs);
});

const createLog = asyncHandler(async (req, res) => {
  const { date, callsClosed, rcpGenerated = 0, items = [] } = req.body;
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
      rcpGenerated: parseInt(rcpGenerated) || 0,
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

  await writeAudit({ req, action: "PRODUCTIVITY_SUBMITTED", entityType: "Productivity", entityId: log.id, newValue: { engineerId, date, callsClosed: callsClosed || 0, rcpGenerated: parseInt(rcpGenerated) || 0, itemCount: items.length } });

  const tlIds = await roleUserIds(orgId, "Team_Leader");
  await writeNotification({
    userIds: tlIds,
    orgId,
    title: "New Productivity Log",
    message: `${req.user.name} submitted a productivity log for ${date}.`,
    type: "action_required",
    entityType: "Productivity",
    entityId: log.id,
  });

  return created(res, log, "Productivity log submitted for validation");
});

const resubmitLog = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date, callsClosed, rcpGenerated = 0, items = [] } = req.body;

  const log = await prisma.productivityLog.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!log) return error(res, "Log not found", 404);
  if (log.engineerId !== req.user.id) return error(res, "Access denied", 403);
  if (log.status !== "Rejected") return error(res, "Only Rejected logs can be resubmitted", 400);

  await prisma.$transaction(async (tx) => {
    await tx.productivityItem.deleteMany({ where: { productivityLogId: id } });
    await tx.productivityLog.update({
      where: { id },
      data: {
        callsClosed: callsClosed !== undefined ? parseInt(callsClosed) || 0 : log.callsClosed,
        rcpGenerated: rcpGenerated !== undefined ? parseInt(rcpGenerated) || 0 : log.rcpGenerated,
        status: "Pending",
        tlNote: null,
        adminNote: null,
        items: {
          create: items.map((item) => ({
            skuId: item.skuId,
            qty: item.qty,
            saleValue: item.saleValue || 0,
          })),
        },
      },
    });
  });

  await writeAudit({ req, action: "PRODUCTIVITY_RESUBMITTED", entityType: "Productivity", entityId: id, oldValue: { status: "Rejected" }, newValue: { status: "Pending" } });

  const tlIds = await roleUserIds(log.orgId, "Team_Leader");
  await writeNotification({
    userIds: tlIds,
    orgId: log.orgId,
    title: "Productivity Log Resubmitted",
    message: `${req.user.name} resubmitted a productivity log for ${new Date(log.date).toISOString().slice(0, 10)}.`,
    type: "action_required",
    entityType: "Productivity",
    entityId: id,
  });

  return success(res, {}, "Log resubmitted for validation");
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

  await writeAudit({ req, action: "PRODUCTIVITY_VALIDATED", entityType: "Productivity", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Validated", tlNote: tlNote || "" } });

  await writeNotification({
    userIds: [log.engineerId],
    orgId: log.orgId,
    title: "Log Validated by Team Leader",
    message: `Your productivity log for ${log.date.toISOString().slice(0, 10)} has been validated and sent to Admin for approval.`,
    type: "approved",
    entityType: "Productivity",
    entityId: id,
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

  await writeAudit({ req, action: "PRODUCTIVITY_REJECTED", entityType: "Productivity", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Rejected", tlNote: tlNote || "" } });

  await writeNotification({
    userIds: [log.engineerId],
    orgId: log.orgId,
    title: "Log Rejected by Team Leader",
    message: `Your productivity log for ${log.date.toISOString().slice(0, 10)} was rejected.${tlNote ? ` Note: ${tlNote}` : ""}`,
    type: "rejected",
    entityType: "Productivity",
    entityId: id,
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

  // Pre-check for a clear, user-facing error in the common (non-concurrent) case.
  for (const item of log.items) {
    const existing = await prisma.engineerStock.findUnique({
      where: { engineerId_skuId: { engineerId: log.engineerId, skuId: item.skuId } },
    });
    if (!existing || existing.qty < item.qty) {
      await writeAudit({
        req,
        action: "PRODUCTIVITY_APPROVAL_BLOCKED_INSUFFICIENT_STOCK",
        entityType: "Productivity",
        entityId: id,
        oldValue: { skuId: item.skuId, requiredQty: item.qty, availableQty: existing?.qty ?? 0 },
      });
      return error(
        res,
        `Cannot approve: engineer has only ${existing?.qty ?? 0} unit(s) of this accessory in van stock, but ${item.qty} were logged. Reconcile stock before approving.`,
        400
      );
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic status guard: only one concurrent approval call can win this update.
      const claimed = await tx.productivityLog.updateMany({
        where: { id, status: "Validated" },
        data: { status: "Approved", adminNote: adminNote || "" },
      });
      if (claimed.count === 0) {
        throw Object.assign(new Error("Log was already processed by another request"), { statusCode: 409 });
      }

      for (const itemUpdate of items) {
        await tx.productivityItem.update({
          where: { id: itemUpdate.id },
          data: { adminIncentive: itemUpdate.adminIncentive ?? 0 },
        });
      }

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
        // Conditional decrement: only succeeds if stock is still sufficient at
        // the moment of the write, guarding against a concurrent deduction
        // (e.g. a return/revoke approved in parallel) racing past the pre-check.
        const deducted = await tx.engineerStock.updateMany({
          where: { engineerId: log.engineerId, skuId: item.skuId, qty: { gte: item.qty } },
          data: { qty: { decrement: item.qty } },
        });
        if (deducted.count === 0) {
          throw Object.assign(new Error("Insufficient van stock — a concurrent transaction already consumed it"), { statusCode: 409 });
        }
      }
    });
  } catch (err) {
    if (err.statusCode === 409) return error(res, err.message, 409);
    throw err;
  }

  const totalIncentive = items.reduce((s, i) => s + (i.adminIncentive || 0), 0);
  await writeAudit({ req, action: "PRODUCTIVITY_APPROVED", entityType: "Productivity", entityId: id, oldValue: { status: "Validated" }, newValue: { status: "Approved", engineerId: log.engineerId, orgId: log.orgId, totalIncentive, adminNote: adminNote || "" } });

  await writeNotification({
    userIds: [log.engineerId],
    orgId: log.orgId,
    title: "Productivity Log Approved",
    message: `Your productivity log has been approved. Incentive earned: ₹${totalIncentive.toLocaleString("en-IN")}.`,
    type: "approved",
    entityType: "Productivity",
    entityId: id,
  });

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

  await writeAudit({ req, action: "PRODUCTIVITY_REJECTED_BY_ADMIN", entityType: "Productivity", entityId: id, oldValue: { status: "Validated" }, newValue: { status: "Rejected", engineerId: log.engineerId, orgId: log.orgId, adminNote: adminNote || "" } });

  await writeNotification({
    userIds: [log.engineerId],
    orgId: log.orgId,
    title: "Productivity Log Rejected by Admin",
    message: `Your productivity log was rejected by Admin.${adminNote ? ` Note: ${adminNote}` : ""}`,
    type: "rejected",
    entityType: "Productivity",
    entityId: id,
  });

  return success(res, updated, "Log rejected");
});

module.exports = { getLogs, createLog, resubmitLog, validateLog, rejectTL, approveLog, rejectAdmin };
