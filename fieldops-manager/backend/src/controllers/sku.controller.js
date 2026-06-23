const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");
const { writeNotification, roleUserIds } = require("../utils/notificationService");

const getAllSkus = asyncHandler(async (req, res) => {
  const where = {};
  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;

  const skus = await prisma.sku.findMany({
    where,
    include: { mainInventory: true },
    orderBy: { id: "asc" },
  });

  const result = skus.map((s) => ({
    id: s.id,
    name: s.name,
    lowStockAlert: s.lowStockAlert,
    qty: s.mainInventory?.qty ?? 0,
    unitPrice: s.mainInventory?.unitPrice ?? 0,
    isLowStock: (s.mainInventory?.qty ?? 0) <= s.lowStockAlert,
    createdAt: s.createdAt,
  }));

  return success(res, result);
});

const createSku = asyncHandler(async (req, res) => {
  const { id, name, lowStockAlert = 0 } = req.body;
  const skuId = id.toUpperCase();
  const orgId = req.user.orgId;

  const existing = await prisma.sku.findUnique({ where: { id: skuId } });
  if (existing) return error(res, "SKU ID already exists", 409);

  const sku = await prisma.$transaction(async (tx) => {
    const s = await tx.sku.create({ data: { id: skuId, name, lowStockAlert, orgId } });
    await tx.mainInventory.create({ data: { skuId: s.id, qty: 0, unitPrice: 0, orgId } });
    return s;
  });

  const action = req.user.role === "Store_Manager" ? "SKU_CREATED_BY_STORE_MANAGER" : "SKU_CREATED";
  await writeAudit({ req, action, entityType: "Sku", entityId: sku.id, newValue: { id: skuId, name, lowStockAlert } });

  // Notify admins when SM creates a SKU
  if (req.user.role === "Store_Manager") {
    const adminIds = await roleUserIds(orgId, "Admin");
    await writeNotification({
      userIds: adminIds,
      orgId,
      title: "New SKU Created",
      message: `Store Manager ${req.user.name} registered SKU ${skuId} (${name}).`,
      type: "info",
      entityType: "Sku",
      entityId: sku.id,
    });
  }

  return created(res, sku, "SKU registered successfully");
});

const updateSku = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, lowStockAlert } = req.body;

  const sku = await prisma.sku.findUnique({ where: { id } });
  if (!sku) return error(res, "SKU not found", 404);
  if (req.user.role !== "Super_Admin" && sku.orgId !== req.user.orgId) return error(res, "SKU not found", 404);

  const updated = await prisma.sku.update({
    where: { id },
    data: { name, ...(lowStockAlert !== undefined && { lowStockAlert }) },
  });

  await writeAudit({ req, action: "SKU_UPDATED", entityType: "Sku", entityId: id, oldValue: { name: sku.name, lowStockAlert: sku.lowStockAlert }, newValue: { name, lowStockAlert } });

  return success(res, updated, "SKU updated");
});

module.exports = { getAllSkus, createSku, updateSku };
