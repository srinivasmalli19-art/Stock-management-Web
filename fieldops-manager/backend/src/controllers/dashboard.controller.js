const prisma = require("../config/db");
const { success } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

const getMonthRange = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const start = new Date(`${y}-${m}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
};

const engineerDashboard = asyncHandler(async (req, res) => {
  const { start, end } = getMonthRange();
  const engineerId = req.user.id;

  const logs = await prisma.productivityLog.findMany({
    where: { engineerId, date: { gte: start, lt: end } },
    include: { items: true },
    orderBy: { date: "desc" },
  });

  const approvedLogs = logs.filter((l) => l.status === "Approved");
  const callsClosed = approvedLogs.reduce((s, l) => s + l.callsClosed, 0);
  const revenue = approvedLogs.reduce((s, l) => s + l.items.reduce((si, i) => si + i.saleValue, 0), 0);
  const incentive = approvedLogs.reduce((s, l) => s + l.items.reduce((si, i) => si + (i.adminIncentive || 0), 0), 0);

  const attendance = await prisma.attendance.findMany({
    where: { engineerId, date: { gte: start, lt: end }, status: "Present" },
  });

  return success(res, { callsClosed, revenue, incentive, daysPresent: attendance.length, logs });
});

const teamLeaderDashboard = asyncHandler(async (req, res) => {
  const { start, end } = getMonthRange();
  const engineers = await prisma.user.findMany({ where: { role: "Engineer", isActive: true }, orderBy: { name: "asc" } });

  const data = await Promise.all(
    engineers.map(async (eng) => {
      const logs = await prisma.productivityLog.findMany({
        where: { engineerId: eng.id, status: "Approved", date: { gte: start, lt: end } },
        include: { items: true },
      });

      const attendance = await prisma.attendance.count({ where: { engineerId: eng.id, date: { gte: start, lt: end }, status: "Present" } });
      const calls = logs.reduce((s, l) => s + l.callsClosed, 0);
      const revenue = logs.reduce((s, l) => s + l.items.reduce((si, i) => si + i.saleValue, 0), 0);
      const incentive = logs.reduce((s, l) => s + l.items.reduce((si, i) => si + (i.adminIncentive || 0), 0), 0);

      return { id: eng.id, name: eng.name, email: eng.email, daysPresent: attendance, callsClosed: calls, revenue, incentive };
    })
  );

  return success(res, data);
});

const storeDashboard = asyncHandler(async (req, res) => {
  const [pendingStockRequests, pendingPurchaseInward, mainInventory, recentPurchase] = await Promise.all([
    prisma.stockRequest.count({ where: { status: "Pending" } }),
    prisma.purchaseInward.count({ where: { status: "Pending" } }),
    prisma.mainInventory.findMany({ include: { sku: true } }),
    prisma.purchaseInward.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { sku: { select: { id: true, name: true } } },
    }),
  ]);

  const lowStockSkus = mainInventory
    .filter((i) => i.qty <= i.sku.lowStockAlert)
    .map((i) => ({ skuId: i.skuId, name: i.sku.name, qty: i.qty, alert: i.sku.lowStockAlert }));

  const totalInventoryValue = mainInventory.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  return success(res, { pendingStockRequests, pendingPurchaseInward, lowStockSkus, totalInventoryValue, recentPurchase });
});

const adminDashboard = asyncHandler(async (req, res) => {
  const [pendingProductivity, pendingPurchase, pendingRevoke] = await Promise.all([
    prisma.productivityLog.count({ where: { status: "Validated" } }),
    prisma.purchaseInward.count({ where: { status: "Pending" } }),
    prisma.revokeRequest.count({ where: { status: "Revoke_Pending" } }),
  ]);

  return success(res, { pendingProductivity, pendingPurchase, pendingRevoke });
});

module.exports = { engineerDashboard, teamLeaderDashboard, storeDashboard, adminDashboard };
