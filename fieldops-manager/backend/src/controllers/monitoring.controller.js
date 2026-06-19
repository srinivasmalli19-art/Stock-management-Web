const prisma = require("../config/db");
const { success } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

const getMonitoringStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const OPS_ACTIONS = [
    "ATTENDANCE_APPROVED",
    "LP_APPROVED",
    "CLAIM_APPROVED",
    "STOCK_REQUEST_APPROVED",
    "REVOKE_APPROVED",
    "PURCHASE_INWARD_APPROVED",
  ];

  const [
    totalOrgs,
    activeOrgs,
    totalUsers,
    auditEvents24h,
    recentActivity,
    opsGroups,
    activeUserGroups,
    dbCheck,
  ] = await Promise.all([
    prisma.organisation.count(),
    prisma.organisation.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: { not: "Super_Admin" } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: oneDayAgo } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where: { action: { in: OPS_ACTIONS }, createdAt: { gte: oneDayAgo } },
      _count: { id: true },
    }),
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.$queryRaw`SELECT 1 AS ok`,
  ]);

  const opsMap = Object.fromEntries(opsGroups.map((g) => [g.action, g._count.id]));

  return success(res, {
    overview: {
      totalOrgs,
      activeOrgs,
      totalUsers,
      activeUsers30d: activeUserGroups.length,
      auditEvents24h,
    },
    operations: {
      attendanceApproved24h: opsMap["ATTENDANCE_APPROVED"] || 0,
      lpApproved24h: opsMap["LP_APPROVED"] || 0,
      claimsApproved24h: opsMap["CLAIM_APPROVED"] || 0,
      stockMovements24h:
        (opsMap["STOCK_REQUEST_APPROVED"] || 0) +
        (opsMap["REVOKE_APPROVED"] || 0) +
        (opsMap["PURCHASE_INWARD_APPROVED"] || 0),
    },
    recentActivity: recentActivity.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      userName: log.userName,
      role: log.role,
      action: log.action,
      entityType: log.entityType,
      organisationId: log.organisationId,
    })),
    health: {
      api: "ok",
      database: dbCheck ? "ok" : "error",
    },
  });
});

module.exports = { getMonitoringStats };
