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
          sku: { select: { id: true, name: true } },
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

  await prisma.$transaction(async (tx) => {
    const engStock = await tx.engineerStock.findUnique({
      where: { engineerId_skuId: { engineerId: rv.engineerId, skuId: rv.skuId } },
    });
    if (engStock) {
      await tx.engineerStock.update({
        where: { engineerId_skuId: { engineerId: rv.engineerId, skuId: rv.skuId } },
        data: { qty: Math.max(0, engStock.qty - rv.qty) },
      });
    }

    const inv = await tx.mainInventory.findUnique({ where: { skuId: rv.skuId } });
    if (inv) {
      await tx.mainInventory.update({ where: { skuId: rv.skuId }, data: { qty: inv.qty + rv.qty } });
    } else {
      await tx.mainInventory.create({ data: { skuId: rv.skuId, qty: rv.qty, unitPrice: 0, orgId: rv.orgId } });
    }

    await tx.revokeRequest.update({ where: { id }, data: { status: "Revoked" } });
    await tx.stockRequest.update({ where: { id: rv.stockRequestId }, data: { status: "Revoked" } });
  });

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
