const prisma = require("../config/db");
const { success, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");
const { writeNotification } = require("../utils/notificationService");

const getRevokes = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;
  if (status) where.status = status;

  const revokes = await prisma.revokeRequest.findMany({
    where,
    include: {
      stockRequest: {
        include: {
          engineer: { select: { id: true, name: true, email: true } },
          sku: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = revokes.map((rv) => ({
    id: rv.id,
    stockRequestId: rv.stockRequestId,
    engineerId: rv.engineerId,
    engineerName: rv.stockRequest.engineer.name,
    engineerEmail: rv.stockRequest.engineer.email,
    skuId: rv.skuId,
    skuCode: rv.stockRequest.sku.code,
    skuName: rv.stockRequest.sku.name,
    qty: rv.qty,
    status: rv.status,
    createdAt: rv.createdAt,
    reqId: rv.stockRequestId,
  }));

  return success(res, result);
});

const approveRevoke = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const rv = await prisma.revokeRequest.findUnique({ where: { id } });
  if (!rv) return error(res, "Revoke request not found", 404);
  if (req.user.role !== "Super_Admin" && rv.orgId !== req.user.orgId) return error(res, "Revoke request not found", 404);
  if (rv.status !== "Revoke_Pending") return error(res, "Revoke already processed", 400);

  const engStockCheck = await prisma.engineerStock.findUnique({
    where: { engineerId_skuId: { engineerId: rv.engineerId, skuId: rv.skuId } },
  });
  if (!engStockCheck || engStockCheck.qty < rv.qty) {
    await writeAudit({
      req,
      action: "REVOKE_APPROVAL_BLOCKED_INSUFFICIENT_STOCK",
      entityType: "RevokeRequest",
      entityId: id,
      oldValue: { skuId: rv.skuId, requiredQty: rv.qty, availableQty: engStockCheck?.qty ?? 0 },
    });
    return error(
      res,
      `Cannot approve: engineer has only ${engStockCheck?.qty ?? 0} unit(s) on hand, but the revoke requests ${rv.qty}. Reconcile stock before approving.`,
      400
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.revokeRequest.updateMany({
        where: { id, status: "Revoke_Pending" },
        data: { status: "Revoked" },
      });
      if (claimed.count === 0) {
        throw Object.assign(new Error("Revoke request was already processed by another request"), { statusCode: 409 });
      }

      const deducted = await tx.engineerStock.updateMany({
        where: { engineerId: rv.engineerId, skuId: rv.skuId, qty: { gte: rv.qty } },
        data: { qty: { decrement: rv.qty } },
      });
      if (deducted.count === 0) {
        throw Object.assign(new Error("Insufficient van stock — a concurrent transaction already consumed it"), { statusCode: 409 });
      }

      const inv = await tx.mainInventory.findUnique({ where: { skuId: rv.skuId } });
      if (inv) {
        await tx.mainInventory.update({ where: { skuId: rv.skuId }, data: { qty: { increment: rv.qty } } });
      } else {
        await tx.mainInventory.create({ data: { skuId: rv.skuId, qty: rv.qty, unitPrice: 0, orgId: rv.orgId } });
      }

      await tx.stockRequest.update({ where: { id: rv.stockRequestId }, data: { status: "Revoked" } });
    });
  } catch (err) {
    if (err.statusCode === 409) return error(res, err.message, 409);
    throw err;
  }

  await writeAudit({ req, action: "REVOKE_APPROVED", entityType: "RevokeRequest", entityId: id, oldValue: { status: "Revoke_Pending" }, newValue: { status: "Revoked", engineerId: rv.engineerId, skuId: rv.skuId, qty: rv.qty } });

  await writeNotification({
    userIds: [rv.engineerId],
    orgId: rv.orgId,
    title: "Revoke Request Approved",
    message: `Your stock revoke has been approved. ${rv.qty} unit(s) returned to warehouse.`,
    type: "approved",
    entityType: "RevokeRequest",
    entityId: id,
  });

  return success(res, {}, `Revoke approved! ${rv.qty} units returned to warehouse.`);
});

const rejectRevoke = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const rv = await prisma.revokeRequest.findUnique({ where: { id } });
  if (!rv) return error(res, "Revoke request not found", 404);
  if (req.user.role !== "Super_Admin" && rv.orgId !== req.user.orgId) return error(res, "Revoke request not found", 404);
  if (rv.status !== "Revoke_Pending") return error(res, "Revoke already processed", 400);

  await prisma.$transaction(async (tx) => {
    await tx.revokeRequest.update({ where: { id }, data: { status: "Rejected" } });
    await tx.stockRequest.update({ where: { id: rv.stockRequestId }, data: { status: "Approved" } });
  });

  await writeAudit({ req, action: "REVOKE_REJECTED", entityType: "RevokeRequest", entityId: id, oldValue: { status: "Revoke_Pending" }, newValue: { status: "Rejected", engineerId: rv.engineerId, skuId: rv.skuId, qty: rv.qty } });

  await writeNotification({
    userIds: [rv.engineerId],
    orgId: rv.orgId,
    title: "Revoke Request Rejected",
    message: "Your stock revoke request was rejected. Your stock allocation remains unchanged.",
    type: "rejected",
    entityType: "RevokeRequest",
    entityId: id,
  });

  return success(res, {}, "Revoke rejected. Stock allocation remains.");
});

module.exports = { getRevokes, approveRevoke, rejectRevoke };
