const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");

const getRequests = asyncHandler(async (req, res) => {
  const { status, engineerId } = req.query;
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;
  if (req.user.role === "Engineer") where.engineerId = req.user.id;
  else if (engineerId) where.engineerId = engineerId;
  if (status) where.status = status;

  const requests = await prisma.stockRequest.findMany({
    where,
    include: {
      engineer: { select: { id: true, name: true, email: true } },
      sku: { select: { id: true, name: true } },
      revokeRequest: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return success(res, requests);
});

const createRequest = asyncHandler(async (req, res) => {
  const { skuId, qty } = req.body;
  const engineerId = req.user.id;
  const orgId = req.user.orgId;

  const sku = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!sku) return error(res, "SKU not found", 404);
  if (sku.orgId !== orgId) return error(res, "SKU not found", 404);

  const request = await prisma.stockRequest.create({
    data: { engineerId, skuId, qty, status: "Pending", orgId },
    include: { sku: true },
  });

  await writeAudit({ req, action: "STOCK_REQUEST_CREATED", entityType: "StockRequest", entityId: request.id, newValue: { skuId, qty } });
  return created(res, request, "Stock request submitted");
});

const approveRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await prisma.stockRequest.findUnique({ where: { id }, include: { sku: true } });
  if (!request) return error(res, "Request not found", 404);
  if (req.user.role !== "Super_Admin" && request.orgId !== req.user.orgId) return error(res, "Request not found", 404);
  if (request.status !== "Pending") return error(res, "Only Pending requests can be approved", 400);

  const inv = await prisma.mainInventory.findUnique({ where: { skuId: request.skuId } });

  if (!inv) {
    return error(res, "Cannot approve: no inventory record found for this SKU", 400);
  }
  if (inv.qty < request.qty) {
    return error(res, `Cannot approve: only ${inv.qty} unit(s) available, ${request.qty} requested`, 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.mainInventory.update({
      where: { skuId: request.skuId },
      data: { qty: inv.qty - request.qty },
    });

    const existing = await tx.engineerStock.findUnique({
      where: { engineerId_skuId: { engineerId: request.engineerId, skuId: request.skuId } },
    });
    if (existing) {
      await tx.engineerStock.update({
        where: { engineerId_skuId: { engineerId: request.engineerId, skuId: request.skuId } },
        data: { qty: existing.qty + request.qty },
      });
    } else {
      await tx.engineerStock.create({
        data: { engineerId: request.engineerId, skuId: request.skuId, qty: request.qty, orgId: request.orgId },
      });
    }

    await tx.stockRequest.update({ where: { id }, data: { status: "Approved" } });
  });

  await writeAudit({ req, action: "STOCK_REQUEST_APPROVED", entityType: "StockRequest", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Approved", qty: request.qty, skuName: request.sku.name } });
  return success(res, {}, `Approved! ${request.qty} units allocated to engineer.`);
});

const rejectRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const request = await prisma.stockRequest.findUnique({ where: { id } });
  if (!request) return error(res, "Request not found", 404);
  if (req.user.role !== "Super_Admin" && request.orgId !== req.user.orgId) return error(res, "Request not found", 404);
  if (request.status !== "Pending") return error(res, "Only Pending requests can be rejected", 400);

  await prisma.stockRequest.update({ where: { id }, data: { status: "Rejected", note: note || "" } });
  await writeAudit({ req, action: "STOCK_REQUEST_REJECTED", entityType: "StockRequest", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Rejected", note: note || null } });
  return success(res, {}, "Request rejected");
});

const submitRevoke = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await prisma.stockRequest.findUnique({ where: { id }, include: { revokeRequest: true } });
  if (!request) return error(res, "Request not found", 404);
  if (req.user.role !== "Super_Admin" && request.orgId !== req.user.orgId) return error(res, "Request not found", 404);
  if (request.status !== "Approved") return error(res, "Only Approved requests can be revoked", 400);
  if (request.revokeRequest) return error(res, "Revoke already submitted for this request", 409);

  let revokeId;
  await prisma.$transaction(async (tx) => {
    const rv = await tx.revokeRequest.create({
      data: {
        stockRequestId: id,
        engineerId: request.engineerId,
        skuId: request.skuId,
        qty: request.qty,
        status: "Revoke_Pending",
        orgId: request.orgId,
      },
    });
    revokeId = rv.id;
    await tx.stockRequest.update({ where: { id }, data: { status: "Revoke_Pending" } });
  });

  await writeAudit({ req, action: "REVOKE_INITIATED", entityType: "RevokeRequest", entityId: revokeId, newValue: { stockRequestId: id, engineerId: request.engineerId, skuId: request.skuId, qty: request.qty } });
  return success(res, {}, "Revoke request submitted to Admin");
});

module.exports = { getRequests, createRequest, approveRequest, rejectRequest, submitRevoke };
