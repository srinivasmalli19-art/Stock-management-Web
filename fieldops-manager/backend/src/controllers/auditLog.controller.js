const prisma = require("../config/db");
const { success, paginate } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

const getAuditLogs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    action,
    entityType,
    userId,
    role,
    from,
    to,
    orgId: filterOrgId,
  } = req.query;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);
  const where = {};

  // Org scoping: Admin sees only their org; Super_Admin sees all (or filtered by orgId param)
  if (req.user.role !== "Super_Admin") {
    where.organisationId = req.user.orgId;
  } else if (filterOrgId) {
    where.organisationId = filterOrgId;
  }

  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (userId) where.userId = userId;
  if (role) where.role = role;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      // Make "to" inclusive: advance to start of the next day
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      where.createdAt.lt = toDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return success(res, logs, "Audit logs fetched", 200, paginate(total, page, limit));
});

module.exports = { getAuditLogs };
