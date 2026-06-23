const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");
const { writeNotification, roleUserIds } = require("../utils/notificationService");

const getReturnRequests = asyncHandler(async (req, res) => {
  const { status, engineerId } = req.query;
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;
  if (req.user.role === "Engineer") where.engineerId = req.user.id;
  else if (engineerId) where.engineerId = engineerId;
  if (status) where.status = status;

  const requests = await prisma.returnRequest.findMany({
    where,
    include: {
      engineer: { select: { id: true, name: true, email: true } },
      sku: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return success(res, requests);
});

const createReturnRequest = asyncHandler(async (req, res) => {
  const { skuId, qty, note } = req.body;
  const engineerId = req.user.id;
  const orgId = req.user.orgId;

  // Verify engineer has enough stock
  const engineerStock = await prisma.engineerStock.findUnique({
    where: { engineerId_skuId: { engineerId, skuId } },
    include: { sku: true },
  });
  if (!engineerStock || engineerStock.qty === 0) {
    return error(res, "You do not have this SKU in your van stock", 400);
  }
  if (engineerStock.qty < qty) {
    return error(res, `Cannot return ${qty} units — only ${engineerStock.qty} available in your van`, 400);
  }

  const request = await prisma.returnRequest.create({
    data: { engineerId, skuId, qty, note: note || null, status: "Pending", orgId },
    include: { sku: true },
  });

  await writeAudit({ req, action: "RETURN_REQUEST_CREATED", entityType: "ReturnRequest", entityId: request.id, newValue: { skuId, qty, skuName: engineerStock.sku.name } });

  const smIds = await roleUserIds(orgId, "Store_Manager");
  await writeNotification({
    userIds: smIds,
    orgId,
    title: "Return Stock Request",
    message: `${req.user.name} wants to return ${qty} unit(s) of ${engineerStock.sku.name}.`,
    type: "action_required",
    entityType: "ReturnRequest",
    entityId: request.id,
  });

  return created(res, request, "Return request submitted to Store Manager");
});

const approveReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const request = await prisma.returnRequest.findUnique({
    where: { id },
    include: { sku: true },
  });
  if (!request) return error(res, "Return request not found", 404);
  if (req.user.role !== "Super_Admin" && request.orgId !== req.user.orgId) return error(res, "Request not found", 404);
  if (request.status !== "Pending") return error(res, "Only Pending return requests can be approved", 400);

  await prisma.$transaction(async (tx) => {
    // Remove qty from engineer's van stock
    const stock = await tx.engineerStock.findUnique({
      where: { engineerId_skuId: { engineerId: request.engineerId, skuId: request.skuId } },
    });
    if (stock) {
      await tx.engineerStock.update({
        where: { engineerId_skuId: { engineerId: request.engineerId, skuId: request.skuId } },
        data: { qty: Math.max(0, stock.qty - request.qty) },
      });
    }

    // Add qty back to main inventory
    const mainInv = await tx.mainInventory.findUnique({ where: { skuId: request.skuId } });
    if (mainInv) {
      await tx.mainInventory.update({
        where: { skuId: request.skuId },
        data: { qty: mainInv.qty + request.qty },
      });
    }

    await tx.returnRequest.update({ where: { id }, data: { status: "Approved" } });
  });

  await writeAudit({ req, action: "RETURN_REQUEST_APPROVED", entityType: "ReturnRequest", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Approved", qty: request.qty, skuName: request.sku.name } });

  await writeNotification({
    userIds: [request.engineerId],
    orgId: request.orgId,
    title: "Return Request Approved",
    message: `Your return of ${request.qty} unit(s) of ${request.sku.name} has been approved. Stock returned to warehouse.`,
    type: "approved",
    entityType: "ReturnRequest",
    entityId: id,
  });

  return success(res, {}, `Approved! ${request.qty} unit(s) of ${request.sku.name} returned to central inventory.`);
});

const rejectReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const request = await prisma.returnRequest.findUnique({ where: { id }, include: { sku: true } });
  if (!request) return error(res, "Return request not found", 404);
  if (req.user.role !== "Super_Admin" && request.orgId !== req.user.orgId) return error(res, "Request not found", 404);
  if (request.status !== "Pending") return error(res, "Only Pending return requests can be rejected", 400);

  await prisma.returnRequest.update({ where: { id }, data: { status: "Rejected", note: note || null } });

  await writeAudit({ req, action: "RETURN_REQUEST_REJECTED", entityType: "ReturnRequest", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Rejected", note: note || null } });

  await writeNotification({
    userIds: [request.engineerId],
    orgId: request.orgId,
    title: "Return Request Rejected",
    message: `Your return request for ${request.qty} unit(s) of ${request.sku?.name || "stock"} was rejected.${note ? ` Note: ${note}` : ""}`,
    type: "rejected",
    entityType: "ReturnRequest",
    entityId: id,
  });

  return success(res, {}, "Return request rejected");
});

const resubmitReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { qty, note } = req.body;

  const request = await prisma.returnRequest.findUnique({ where: { id }, include: { sku: true } });
  if (!request) return error(res, "Return request not found", 404);
  if (request.engineerId !== req.user.id) return error(res, "Access denied", 403);
  if (request.status !== "Rejected") return error(res, "Only Rejected return requests can be resubmitted", 400);

  const newQty = qty || request.qty;

  // Re-validate stock is sufficient
  const stock = await prisma.engineerStock.findUnique({
    where: { engineerId_skuId: { engineerId: request.engineerId, skuId: request.skuId } },
  });
  if (!stock || stock.qty < newQty) {
    return error(res, `Insufficient van stock. Available: ${stock?.qty || 0}`, 400);
  }

  await prisma.returnRequest.update({
    where: { id },
    data: { qty: newQty, note: note !== undefined ? note : request.note, status: "Pending" },
  });

  await writeAudit({ req, action: "RETURN_REQUEST_RESUBMITTED", entityType: "ReturnRequest", entityId: id, oldValue: { status: "Rejected" }, newValue: { status: "Pending" } });

  const smIds = await roleUserIds(request.orgId, "Store_Manager");
  await writeNotification({
    userIds: smIds,
    orgId: request.orgId,
    title: "Return Request Resubmitted",
    message: `${req.user.name} resubmitted a return request for ${newQty} unit(s) of ${request.sku?.name || "stock"}.`,
    type: "action_required",
    entityType: "ReturnRequest",
    entityId: id,
  });

  return success(res, {}, "Return request resubmitted");
});

module.exports = { getReturnRequests, createReturnRequest, approveReturnRequest, rejectReturnRequest, resubmitReturnRequest };
