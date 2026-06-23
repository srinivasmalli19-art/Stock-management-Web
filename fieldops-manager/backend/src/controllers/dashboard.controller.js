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

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const ACTIVITY_NOISE = ["NOTIFICATION_READ", "NOTIFICATIONS_READ_ALL", "LOGIN", "LOGOUT", "TOKEN_REFRESHED"];

// GET /dashboard/activity — role-scoped recent audit events (latest 10)
const getActivity = asyncHandler(async (req, res) => {
  const { role, orgId, id: userId } = req.user;
  const where = { action: { notIn: ACTIVITY_NOISE } };

  if (role === "Engineer") {
    where.userId = userId;
  } else if (role === "Team_Leader") {
    where.organisationId = orgId;
    where.role = "Engineer";
  } else if (role === "Store_Manager") {
    where.organisationId = orgId;
    where.entityType = { in: ["StockRequest", "RevokeRequest", "PurchaseInward", "ClaimRequest"] };
  } else if (role === "Admin") {
    where.organisationId = orgId;
  }
  // Super_Admin: no filter → global

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, action: true, entityType: true, entityId: true, userName: true, role: true, createdAt: true },
  });

  return success(res, logs);
});

// GET /dashboard/widgets — role-scoped pending counts + today summary
const getWidgets = asyncHandler(async (req, res) => {
  const { role, orgId, id: userId } = req.user;
  const { start: todayStart, end: todayEnd } = getTodayRange();

  if (role === "Engineer") {
    const [pendingStock, pendingApprovals, todayLog] = await Promise.all([
      prisma.stockRequest.count({ where: { engineerId: userId, status: "Pending" } }),
      prisma.productivityLog.count({ where: { engineerId: userId, status: { in: ["Pending", "Validated"] } } }),
      prisma.productivityLog.findFirst({
        where: { engineerId: userId, date: { gte: todayStart, lt: todayEnd } },
        include: { items: true },
      }),
    ]);
    const todayRevenue = (todayLog?.items || []).reduce((s, i) => s + i.saleValue, 0);
    return success(res, {
      pending: { stockRequests: pendingStock, pendingApprovals },
      today: { callsClosed: todayLog?.callsClosed || 0, revenue: todayRevenue },
    });
  }

  if (role === "Team_Leader") {
    const [pendingValidations, pendingAttendance, pendingLP, validatedToday] = await Promise.all([
      prisma.productivityLog.count({ where: { orgId, status: "Pending" } }),
      prisma.staffAttendance.count({ where: { orgId, submissionStatus: "Pending" } }),
      prisma.lpRequest.count({ where: { orgId, status: "LP_PENDING_ADMIN_APPROVAL" } }),
      prisma.auditLog.count({ where: { organisationId: orgId, action: "PRODUCTIVITY_VALIDATED", createdAt: { gte: todayStart, lt: todayEnd } } }),
    ]);
    return success(res, {
      pending: { validations: pendingValidations, attendance: pendingAttendance, lpRequests: pendingLP },
      today: { validatedToday, pendingValidation: pendingValidations },
    });
  }

  if (role === "Store_Manager") {
    const [pendingStock, pendingReturn, pendingPurchase, pendingClaims, stockToday, purchaseToday] = await Promise.all([
      prisma.stockRequest.count({ where: { orgId, status: "Pending" } }),
      prisma.returnRequest.count({ where: { orgId, status: "Pending" } }),
      prisma.purchaseInward.count({ where: { orgId, status: "Pending" } }),
      prisma.claimRequest.count({ where: { orgId, status: "CLAIM_VALIDATION_PENDING" } }),
      prisma.stockRequest.count({ where: { orgId, createdAt: { gte: todayStart, lt: todayEnd } } }),
      prisma.purchaseInward.count({ where: { orgId, createdAt: { gte: todayStart, lt: todayEnd } } }),
    ]);
    return success(res, {
      pending: { stockRequests: pendingStock, returnRequests: pendingReturn, purchaseInward: pendingPurchase, claimValidations: pendingClaims },
      today: { stockRequestsToday: stockToday, purchaseInwardToday: purchaseToday },
    });
  }

  if (role === "Admin") {
    const [pendingProductivity, pendingPurchase, pendingRevoke, pendingReturn, pendingLP, pendingClaims, pendingAttendance, approvalsToday, usersToday] = await Promise.all([
      prisma.productivityLog.count({ where: { orgId, status: "Validated" } }),
      prisma.purchaseInward.count({ where: { orgId, status: "Pending" } }),
      prisma.revokeRequest.count({ where: { orgId, status: "Revoke_Pending" } }),
      prisma.returnRequest.count({ where: { orgId, status: "Pending" } }),
      prisma.lpRequest.count({ where: { orgId, status: "LP_PENDING_ADMIN_APPROVAL" } }),
      prisma.claimRequest.count({ where: { orgId, status: "CLAIM_ADMIN_APPROVAL_PENDING" } }),
      prisma.staffAttendance.count({ where: { orgId, submissionStatus: "Pending" } }),
      prisma.auditLog.count({ where: { organisationId: orgId, action: "PRODUCTIVITY_APPROVED", createdAt: { gte: todayStart, lt: todayEnd } } }),
      prisma.auditLog.count({ where: { organisationId: orgId, action: "USER_CREATED", createdAt: { gte: todayStart, lt: todayEnd } } }),
    ]);
    return success(res, {
      pending: { productivity: pendingProductivity, purchase: pendingPurchase, revoke: pendingRevoke, returnRequests: pendingReturn, lp: pendingLP, claims: pendingClaims, attendance: pendingAttendance },
      today: { approvalsToday, usersToday },
    });
  }

  // Super_Admin
  const [totalOrgs, activeOrgs, totalUsers, auditEventsToday] = await Promise.all([
    prisma.organisation.count(),
    prisma.organisation.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: { not: "Super_Admin" } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: todayStart, lt: todayEnd } } }),
  ]);
  return success(res, {
    pending: {},
    today: { auditEventsToday },
    global: { totalOrgs, activeOrgs, totalUsers },
  });
});

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

// GET /dashboard/engineer-performance?month=YYYY-MM — Admin + TL
const getEngineerPerformance = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const orgId = req.user.orgId;

  const monthStr = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [year, mo] = monthStr.split("-");
  const start = new Date(`${year}-${mo}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const engWhere = { role: "Engineer", isActive: true };
  if (req.user.role !== "Super_Admin") engWhere.orgId = orgId;

  const engineers = await prisma.user.findMany({ where: engWhere, orderBy: { name: "asc" } });
  if (engineers.length === 0) return success(res, []);

  const engineerIds = engineers.map((e) => e.id);

  const [allLogs, attGroups] = await Promise.all([
    prisma.productivityLog.findMany({
      where: { engineerId: { in: engineerIds }, status: "Approved", date: { gte: start, lt: end } },
      include: { items: true },
    }),
    prisma.attendance.groupBy({
      by: ["engineerId"],
      where: { engineerId: { in: engineerIds }, date: { gte: start, lt: end }, status: "Present" },
      _count: { id: true },
    }),
  ]);

  const attMap = Object.fromEntries(attGroups.map((a) => [a.engineerId, a._count.id]));
  const logsByEngineer = {};
  allLogs.forEach((log) => {
    if (!logsByEngineer[log.engineerId]) logsByEngineer[log.engineerId] = [];
    logsByEngineer[log.engineerId].push(log);
  });

  const data = engineers.map((eng) => {
    const logs = logsByEngineer[eng.id] || [];
    const callsClosed = logs.reduce((s, l) => s + l.callsClosed, 0);
    const revenue = logs.reduce((s, l) => s + l.items.reduce((si, i) => si + i.saleValue, 0), 0);
    const rcpGenerated = logs.reduce((s, l) => s + (l.rcpGenerated || 0), 0);
    const daysPresent = attMap[eng.id] || 0;
    const perCallRevenue = callsClosed > 0 ? Math.round((revenue / callsClosed) * 100) / 100 : 0;
    return { id: eng.id, name: eng.name, daysPresent, callsClosed, revenue, perCallRevenue, rcpGenerated };
  });

  return success(res, data);
});

module.exports = { engineerDashboard, teamLeaderDashboard, storeDashboard, adminDashboard, getActivity, getWidgets, getEngineerPerformance };
