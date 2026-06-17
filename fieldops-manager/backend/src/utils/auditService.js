const prisma = require("../config/db");
const logger = require("./logger");

/**
 * Write a single audit log entry.
 *
 * All context (userId, userName, role, orgId, ip, userAgent) is extracted
 * from req automatically — callers only provide business context.
 *
 * Errors are swallowed: audit failure must never fail a business transaction.
 *
 * @param {object} opts
 * @param {import("express").Request} opts.req
 * @param {string}  opts.action     - Action constant e.g. "STOCK_REQUEST_APPROVED"
 * @param {string}  opts.entityType - Prisma model name e.g. "StockRequest"
 * @param {string}  opts.entityId   - CUID of the affected record
 * @param {object}  [opts.oldValue] - State before the change
 * @param {object}  [opts.newValue] - State after the change
 */
const writeAudit = async ({ req, action, entityType, entityId, oldValue, newValue }) => {
  try {
    const { id: userId, name: userName, role, orgId } = req.user;

    // Prefer x-forwarded-for (set by Render's reverse proxy) over req.ip
    const rawIp = req.headers["x-forwarded-for"] || req.ip || "";
    const ipAddress = rawIp.split(",")[0].trim() || null;
    const userAgent = req.headers["user-agent"] || null;

    await prisma.auditLog.create({
      data: {
        organisationId: orgId || null,
        userId,
        userName,
        role,
        action,
        entityType,
        entityId,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    // Log to Winston but never throw — audit must not block business ops
    logger.error(`[AuditLog] write failed — action=${action} entity=${entityType}/${entityId}: ${err.message}`);
  }
};

module.exports = { writeAudit };
