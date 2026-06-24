const prisma = require("../config/db");
const { success, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { Parser } = require("json2csv");

const getMainInventory = asyncHandler(async (req, res) => {
  const where = {};
  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;

  const items = await prisma.mainInventory.findMany({
    where,
    include: { sku: { select: { id: true, code: true, name: true, lowStockAlert: true } } },
    orderBy: { sku: { code: "asc" } },
  });

  const result = items.map((item) => ({
    skuId: item.skuId,
    skuCode: item.sku.code,
    skuName: item.sku.name,
    qty: item.qty,
    unitPrice: item.unitPrice,
    totalValue: item.qty * item.unitPrice,
    lowStockAlert: item.sku.lowStockAlert,
    isLowStock: item.qty <= item.sku.lowStockAlert,
    updatedAt: item.updatedAt,
  }));

  return success(res, result);
});

const getEngineerStock = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // IDOR: verify engineer belongs to same org before exposing their stock
  if (req.user.role !== "Super_Admin") {
    const engineer = await prisma.user.findUnique({ where: { id } });
    if (!engineer || engineer.orgId !== req.user.orgId) return error(res, "Engineer not found", 404);
  }

  const stock = await prisma.engineerStock.findMany({
    where: { engineerId: id },
    include: { sku: { select: { id: true, code: true, name: true } } },
    orderBy: { sku: { code: "asc" } },
  });

  return success(res, stock);
});

const getMyStock = asyncHandler(async (req, res) => {
  const stock = await prisma.engineerStock.findMany({
    where: { engineerId: req.user.id },
    include: { sku: { select: { id: true, code: true, name: true } } },
    orderBy: { sku: { code: "asc" } },
  });

  return success(res, stock);
});

const downloadInventoryCsv = asyncHandler(async (req, res) => {
  const where = {};
  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;

  const items = await prisma.mainInventory.findMany({
    where,
    include: { sku: { select: { id: true, code: true, name: true, lowStockAlert: true } } },
    orderBy: { sku: { code: "asc" } },
  });

  const rows = items.map((item) => ({
    "SKU ID": item.sku.code,
    "Item Name": item.sku.name,
    "Available Qty": item.qty,
    "Unit Price": item.unitPrice,
    "Total Value": item.qty * item.unitPrice,
    "Alert Threshold": item.sku.lowStockAlert,
    Status: item.qty <= item.sku.lowStockAlert ? "Low" : "OK",
  }));

  if (rows.length === 0) return error(res, "No inventory records available for export", 400);

  const parser = new Parser({ fields: Object.keys(rows[0]) });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="inventory_report.csv"`);
  res.send(csv);
});

module.exports = { getMainInventory, getEngineerStock, getMyStock, downloadInventoryCsv };
