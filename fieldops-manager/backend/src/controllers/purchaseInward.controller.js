const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");
const { writeNotification } = require("../utils/notificationService");

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
    include: { sku: { select: { id: true, code: true, name: true } } },
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

  const normalizedInvoiceNo = invoiceNo?.trim() || null;
  if (normalizedInvoiceNo) {
    const dup = await prisma.purchaseInward.findUnique({
      where: { orgId_vendor_invoiceNo: { orgId, vendor, invoiceNo: normalizedInvoiceNo } },
    });
    if (dup) {
      return error(res, `Invoice ${normalizedInvoiceNo} from ${vendor} has already been recorded — this looks like a duplicate delivery entry`, 409);
    }
  }

  const entry = await prisma.purchaseInward.create({
    data: {
      skuId, qty, unitPrice, vendor,
      invoiceNo: normalizedInvoiceNo,
      date: new Date(date),
      status: "Pending",
      orgId,
      createdById: req.user.id,
    },
    include: { sku: { select: { id: true, code: true, name: true } } },
  });

  await writeAudit({ req, action: "PURCHASE_INWARD_CREATED", entityType: "PurchaseInward", entityId: entry.id, newValue: { skuId, qty, unitPrice, vendor, invoiceNo: entry.invoiceNo } });
  return created(res, entry, "Purchase entry submitted for Admin approval");
});

const approveInward = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.purchaseInward.findUnique({ where: { id }, include: { sku: true } });
  if (!entry) return error(res, "Purchase entry not found", 404);
  if (req.user.role !== "Super_Admin" && entry.orgId !== req.user.orgId) return error(res, "Purchase entry not found", 404);
  if (entry.status !== "Pending") return error(res, "Entry already processed", 400);

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.purchaseInward.updateMany({
        where: { id, status: "Pending" },
        data: { status: "Approved" },
      });
      if (claimed.count === 0) {
        throw Object.assign(new Error("Purchase entry was already processed by another request"), { statusCode: 409 });
      }

      const inv = await tx.mainInventory.findUnique({ where: { skuId: entry.skuId } });
      if (inv) {
        await tx.mainInventory.update({
          where: { skuId: entry.skuId },
          data: { qty: { increment: entry.qty }, unitPrice: entry.unitPrice },
        });
      } else {
        await tx.mainInventory.create({
          data: { skuId: entry.skuId, qty: entry.qty, unitPrice: entry.unitPrice, orgId: entry.orgId },
        });
      }
    });
  } catch (err) {
    if (err.statusCode === 409) return error(res, err.message, 409);
    throw err;
  }

  await writeAudit({ req, action: "PURCHASE_INWARD_APPROVED", entityType: "PurchaseInward", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Approved", qty: entry.qty, skuName: entry.sku.name } });

  if (entry.createdById) {
    await writeNotification({
      userIds: [entry.createdById],
      orgId: entry.orgId,
      title: "Purchase Entry Approved",
      message: `Your purchase entry for ${entry.qty} unit(s) of ${entry.sku.name}${entry.invoiceNo ? ` (Invoice ${entry.invoiceNo})` : ""} was approved and added to warehouse stock.`,
      type: "approved",
      entityType: "PurchaseInward",
      entityId: id,
    });
  }

  return success(res, {}, `Approved! +${entry.qty} units of ${entry.sku.name} added to warehouse.`);
});

const rejectInward = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const entry = await prisma.purchaseInward.findUnique({ where: { id }, include: { sku: true } });
  if (!entry) return error(res, "Purchase entry not found", 404);
  if (req.user.role !== "Super_Admin" && entry.orgId !== req.user.orgId) return error(res, "Purchase entry not found", 404);
  if (entry.status !== "Pending") return error(res, "Entry already processed", 400);

  const claimed = await prisma.purchaseInward.updateMany({
    where: { id, status: "Pending" },
    data: { status: "Rejected" },
  });
  if (claimed.count === 0) return error(res, "Entry already processed", 409);

  await writeAudit({ req, action: "PURCHASE_INWARD_REJECTED", entityType: "PurchaseInward", entityId: id, oldValue: { status: "Pending" }, newValue: { status: "Rejected" } });

  if (entry.createdById) {
    await writeNotification({
      userIds: [entry.createdById],
      orgId: entry.orgId,
      title: "Purchase Entry Rejected",
      message: `Your purchase entry for ${entry.qty} unit(s) of ${entry.sku.name}${entry.invoiceNo ? ` (Invoice ${entry.invoiceNo})` : ""} was rejected.`,
      type: "rejected",
      entityType: "PurchaseInward",
      entityId: id,
    });
  }

  return success(res, {}, "Purchase entry rejected");
});

module.exports = { getInwards, createInward, approveInward, rejectInward };
