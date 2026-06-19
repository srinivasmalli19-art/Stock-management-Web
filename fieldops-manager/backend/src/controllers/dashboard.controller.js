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
  const engWhere = { role: "Engineer", isActive: true };
  if (req.user.role !== "Super_Admin") engWhere.orgId = req.user.orgId;

  // Query 1: all engineers
  const engineers = await prisma.user.findMany({ where: engWhere, orderBy: { name: "asc" } });
  if (engineers.length === 0) return success(res, []);

  const engineerIds = engineers.map((e) => e.id);

  // Query 2: all approved logs for all engineers in one batch (replaces N per-engineer queries)
  const allLogs = await prisma.productivityLog.findMany({
    where: { engineerId: { in: engineerIds }, status: "Approved", date: { gte: start, lt: end } },
    include: { items: true },
  });

  // Query 3: attendance counts grouped by engineer (replaces N per-engineer queries)
  const attGroups = await prisma.attendance.groupBy({
    by: ["engineerId"],
    where: { engineerId: { in: engineerIds }, date: { gte: start, lt: end }, status: "Present" },
    _count: { id: true },
  });

  // Build O(1) lookup maps
  const attMap = Object.fromEntries(attGroups.map((a) => [a.engineerId, a._count.id]));
  const logsByEngineer = {};
  allLogs.forEach((log) => {
    if (!logsByEngineer[log.engineerId]) logsByEngineer[log.engineerId] = [];
    logsByEngineer[log.engineerId].push(log);
  });

  const data = engineers.map((eng) => {
    const logs = logsByEngineer[eng.id] || [];
    const calls = logs.reduce((s, l) => s + l.callsClosed, 0);
    const revenue = logs.reduce((s, l) => s + l.items.reduce((si, i) => si + i.saleValue, 0), 0);
    const incentive = logs.reduce((s, l) => s + l.items.reduce((si, i) => si + (i.adminIncentive || 0), 0), 0);
    return { id: eng.id, name: eng.name, email: eng.email, daysPresent: attMap[eng.id] || 0, callsClosed: calls, revenue, incentive };
  });

  return success(res, data);
});

const storeDashboard = asyncHandler(async (req, res) => {
  const orgWhere = req.user.role !== "Super_Admin" ? { orgId: req.user.orgId } : {};

  const [pendingStockRequests, pendingPurchaseInward, mainInventory, recentPurchase] = await Promise.all([
    prisma.stockRequest.count({ where: { status: "Pending", ...orgWhere } }),
    prisma.purchaseInward.count({ where: { status: "Pending", ...orgWhere } }),
    prisma.mainInventory.findMany({ where: orgWhere, include: { sku: true } }),
    prisma.purchaseInward.findMany({
      where: orgWhere,
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
  const orgWhere = req.user.role !== "Super_Admin" ? { orgId: req.user.orgId } : {};

  const [pendingProductivity, pendingPurchase, pendingRevoke] = await Promise.all([
    prisma.productivityLog.count({ where: { status: "Validated", ...orgWhere } }),
    prisma.purchaseInward.count({ where: { status: "Pending", ...orgWhere } }),
    prisma.revokeRequest.count({ where: { status: "Revoke_Pending", ...orgWhere } }),
  ]);

  return success(res, { pendingProductivity, pendingPurchase, pendingRevoke });
});

module.exports = { engineerDashboard, teamLeaderDashboard, storeDashboard, adminDashboard };
