const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

const getAllSkus = asyncHandler(async (req, res) => {
  const skus = await prisma.sku.findMany({
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

  const existing = await prisma.sku.findUnique({ where: { id: skuId } });
  if (existing) return error(res, "SKU ID already exists", 409);

  const sku = await prisma.$transaction(async (tx) => {
    const s = await tx.sku.create({ data: { id: skuId, name, lowStockAlert } });
    await tx.mainInventory.create({ data: { skuId: s.id, qty: 0, unitPrice: 0 } });
    return s;
  });

  return created(res, sku, "SKU registered successfully");
});

const updateSku = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, lowStockAlert } = req.body;

  const sku = await prisma.sku.update({
    where: { id },
    data: { name, ...(lowStockAlert !== undefined && { lowStockAlert }) },
  });

  return success(res, sku, "SKU updated");
});

module.exports = { getAllSkus, createSku, updateSku };
