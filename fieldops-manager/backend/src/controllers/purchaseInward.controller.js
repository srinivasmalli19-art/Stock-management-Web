const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

const getInwards = asyncHandler(async (req, res) => {
  const { status, vendor, month } = req.query;
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;
  if (status) where.status = status;
  if (vendor) where.vendor = { contains: vendor, mode: "insensitive" };
  if (month) {
    const [year, mo] = month.split("-");
    const start = new Date(`${year}-${mo}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    where.date = { gte: start, lt: end };
  }

  const inwards = await prisma.purchaseInward.findMany({
    where,
    include: { sku: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });

  return success(res, inwards);
});

const createInward = asyncHandler(async (req, res) => {
  const { skuId, qty, unitPrice, vendor, invoiceNo, date } = req.body;
  const orgId = req.user.orgId;

  const sku = await prisma.sku.findUnique({ where: { id: skuId } });
  if (!sku) return error(res, "SKU not found", 404);
  if (sku.orgId !== orgId) return error(res, "SKU not found", 404);

  const entry = await prisma.purchaseInward.create({
    data: { skuId, qty, unitPrice, vendor, invoiceNo: invoiceNo || "N/A", date: new Date(date), status: "Pending", orgId },
    include: { sku: { select: { id: true, name: true } } },
  });

  return created(res, entry, "Purchase entry submitted for Admin approval");
});

const approveInward = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.purchaseInward.findUnique({ where: { id }, include: { sku: true } });
  if (!entry) return error(res, "Purchase entry not found", 404);
  if (req.user.role !== "Super_Admin" && entry.orgId !== req.user.orgId) return error(res, "Purchase entry not found", 404);
  if (entry.status !== "Pending") return error(res, "Entry already processed", 400);

  await prisma.$transaction(async (tx) => {
    const inv = await tx.mainInventory.findUnique({ where: { skuId: entry.skuId } });
    if (inv) {
      await tx.mainInventory.update({
        where: { skuId: entry.skuId },
        data: { qty: inv.qty + entry.qty, unitPrice: entry.unitPrice },
      });
    } else {
      await tx.mainInventory.create({
        data: { skuId: entry.skuId, qty: entry.qty, unitPrice: entry.unitPrice, orgId: entry.orgId },
      });
    }
    await tx.purchaseInward.update({ where: { id }, data: { status: "Approved" } });
  });

  return success(res, {}, `Approved! +${entry.qty} units of ${entry.sku.name} added to warehouse.`);
});

const rejectInward = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.purchaseInward.findUnique({ where: { id } });
  if (!entry) return error(res, "Purchase entry not found", 404);
  if (req.user.role !== "Super_Admin" && entry.orgId !== req.user.orgId) return error(res, "Purchase entry not found", 404);
  if (entry.status !== "Pending") return error(res, "Entry already processed", 400);

  await prisma.purchaseInward.update({ where: { id }, data: { status: "Rejected" } });
  return success(res, {}, "Purchase entry rejected");
});

module.exports = { getInwards, createInward, approveInward, rejectInward };
