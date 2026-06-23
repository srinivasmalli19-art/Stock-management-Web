const prisma = require("../config/db");
const logger = require("./logger");

/**
 * Create one Notification row per userId.
 * Errors are swallowed — notification failure must never fail a business transaction.
 *
 * @param {object} opts
 * @param {string[]}       opts.userIds      - Recipients (must be non-empty)
 * @param {string|null}    [opts.orgId]      - organisationId (null for Super_Admin global events)
 * @param {string}         opts.title        - Short notification title
 * @param {string}         opts.message      - Descriptive sentence(s)
 * @param {string}         [opts.type]       - "info" | "action_required" | "approved" | "rejected"
 * @param {string}         opts.entityType   - Prisma model name
 * @param {string}         opts.entityId     - CUID of the affected record
 */
const writeNotification = async ({
  userIds,
  orgId = null,
  title,
  message,
  type = "info",
  entityType,
  entityId,
}) => {
  if (!userIds || userIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        organisationId: orgId ?? null,
        title,
        message,
        type,
        entityType,
        entityId,
        isRead: false,
      })),
    });
  } catch (err) {
    logger.error(`[Notification] write failed — title="${title}" entity=${entityType}/${entityId}: ${err.message}`);
  }
};

/**
 * Return the IDs of all active users with a given role in an org.
 * Returns [] on error so callers never need a try/catch.
 */
const roleUserIds = async (orgId, role) => {
  if (!orgId) return [];
  try {
    const users = await prisma.user.findMany({
      where: { orgId, role, isActive: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  } catch {
    return [];
  }
};

module.exports = { writeNotification, roleUserIds };
