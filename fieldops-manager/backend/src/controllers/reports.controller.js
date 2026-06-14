const prisma = require("../config/db");
const { success } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { Parser } = require("json2csv");

// Build WAVCO (Weighted Average Cost) per SKU from all approved purchases.
// Returns a map: { skuId: weightedAvgUnitPrice }
// Falls back to MainInventory.unitPrice for SKUs with no purchase history.
async function buildWeightedAvgCost() {
  const purchases = await prisma.purchaseInward.findMany({
    where: { status: "Approved" },
    select: { skuId: true, qty: true, unitPrice: true },
  });

  const totalQty = {};
  const totalCost = {};

  purchases.forEach(({ skuId, qty, unitPrice }) => {
    if (!totalQty[skuId]) { totalQty[skuId] = 0; totalCost[skuId] = 0; }
    totalQty[skuId] += qty;
    totalCost[skuId] += qty * unitPrice;
  });

  const wavco = {};
  Object.keys(totalQty).forEach((skuId) => {
    wavco[skuId] = totalQty[skuId] > 0 ? totalCost[skuId] / totalQty[skuId] : 0;
  });
  return wavco;
}

const getPLReport = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const monthStr = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [year, mo] = monthStr.split("-");
  const start = new Date(`${year}-${mo}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const [engineers, wavco] = await Promise.all([
    prisma.user.findMany({ where: { role: "Engineer", isActive: true }, orderBy: { name: "asc" } }),
    buildWeightedAvgCost(),
  ]);

  const engineerData = await Promise.all(
    engineers.map(async (eng) => {
      const logs = await prisma.productivityLog.findMany({
        where: { engineerId: eng.id, status: "Approved", date: { gte: start, lt: end } },
        include: {
          items: { include: { sku: { include: { mainInventory: true } } } },
        },
      });

      let revenue = 0, incentive = 0, accessoriesCost = 0;

      logs.forEach((log) => {
        log.items.forEach((item) => {
          revenue += item.saleValue;
          incentive += item.adminIncentive || 0;
          // WAVCO: use weighted average if purchase history exists, else fall back to current unit price
          const unitPrice = wavco[item.skuId] ?? item.sku?.mainInventory?.unitPrice ?? 0;
          accessoriesCost += item.qty * unitPrice;
        });
      });

      const pl = revenue - incentive - accessoriesCost;

      return {
        engineerId: eng.id,
        name: eng.name,
        email: eng.email,
        revenue,
        incentive,
        accessoriesCost,
        pl,
      };
    })
  );

  const totals = engineerData.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      incentive: acc.incentive + row.incentive,
      accessoriesCost: acc.accessoriesCost + row.accessoriesCost,
      pl: acc.pl + row.pl,
    }),
    { revenue: 0, incentive: 0, accessoriesCost: 0, pl: 0 }
  );

  return success(res, { engineers: engineerData, totals, month: monthStr, costMethod: "WAVCO" });
});

const downloadPLCsv = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const monthStr = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [year, mo] = monthStr.split("-");
  const start = new Date(`${year}-${mo}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const [engineers, wavco] = await Promise.all([
    prisma.user.findMany({ where: { role: "Engineer", isActive: true }, orderBy: { name: "asc" } }),
    buildWeightedAvgCost(),
  ]);

  const rows = await Promise.all(
    engineers.map(async (eng) => {
      const logs = await prisma.productivityLog.findMany({
        where: { engineerId: eng.id, status: "Approved", date: { gte: start, lt: end } },
        include: { items: { include: { sku: { include: { mainInventory: true } } } } },
      });

      let revenue = 0, incentive = 0, accessoriesCost = 0;
      logs.forEach((log) => {
        log.items.forEach((item) => {
          revenue += item.saleValue;
          incentive += item.adminIncentive || 0;
          const unitPrice = wavco[item.skuId] ?? item.sku?.mainInventory?.unitPrice ?? 0;
          accessoriesCost += item.qty * unitPrice;
        });
      });

      return {
        Engineer: eng.name,
        Revenue: revenue,
        Incentive: incentive,
        "Accessories Cost (WAVCO)": accessoriesCost,
        "P&L": revenue - incentive - accessoriesCost,
      };
    })
  );

  const parser = new Parser({ fields: ["Engineer", "Revenue", "Incentive", "Accessories Cost (WAVCO)", "P&L"] });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="pl_report_${monthStr}.csv"`);
  res.send(csv);
});

const getSupplierReport = asyncHandler(async (req, res) => {
  const inwards = await prisma.purchaseInward.findMany({
    where: { status: "Approved" },
    include: { sku: { select: { id: true, name: true } } },
    orderBy: { vendor: "asc" },
  });

  const vendorMap = {};
  inwards.forEach((p) => {
    const key = p.vendor;
    if (!vendorMap[key]) vendorMap[key] = { vendor: p.vendor, entries: [], totalQty: 0, totalValue: 0 };
    vendorMap[key].entries.push({ skuId: p.skuId, skuName: p.sku.name, qty: p.qty, value: p.qty * p.unitPrice, invoiceNo: p.invoiceNo, date: p.date });
    vendorMap[key].totalQty += p.qty;
    vendorMap[key].totalValue += p.qty * p.unitPrice;
  });

  return success(res, Object.values(vendorMap).sort((a, b) => b.totalValue - a.totalValue));
});

const downloadSupplierCsv = asyncHandler(async (req, res) => {
  const inwards = await prisma.purchaseInward.findMany({
    where: { status: "Approved" },
    include: { sku: { select: { id: true, name: true } } },
    orderBy: [{ vendor: "asc" }, { date: "asc" }],
  });

  const rows = inwards.map((p) => ({
    Vendor: p.vendor,
    "SKU ID": p.skuId,
    "Item Name": p.sku.name,
    "Invoice No": p.invoiceNo,
    "Qty Received": p.qty,
    "Unit Price": p.unitPrice,
    "Total Value": p.qty * p.unitPrice,
    Date: p.date.toISOString().split("T")[0],
  }));

  const parser = new Parser({ fields: Object.keys(rows[0] || {}) });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="supplier_report.csv"`);
  res.send(csv);
});

module.exports = { getPLReport, downloadPLCsv, getSupplierReport, downloadSupplierCsv };
