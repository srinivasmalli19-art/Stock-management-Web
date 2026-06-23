const prisma = require("../config/db");
const { success, error, paginate } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");

// GET /api/notifications
const getNotifications = asyncHandler(async (req, res) => {
  const { limit = 20, page = 1, unreadOnly } = req.query;
  const take = Math.min(parseInt(limit) || 20, 100);
  const skip = (parseInt(page) - 1) * take;

  const where = { userId: req.user.id };
  if (unreadOnly === "true") where.isRead = false;

  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  return success(res, items, "Success", 200, paginate(total, page, take));
});

// GET /api/notifications/unread-count
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, isRead: false },
  });
  return success(res, { count });
});

// PATCH /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return error(res, "Notification not found", 404);

  // Strict ownership check — users may only mark their own notifications
  if (notification.userId !== req.user.id) return error(res, "Not authorized", 403);

  if (!notification.isRead) {
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    await writeAudit({
      req,
      action: "NOTIFICATION_READ",
      entityType: "Notification",
      entityId: id,
    });
  }

  return success(res, {}, "Marked as read");
});

// PATCH /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });

  if (count > 0) {
    await writeAudit({
      req,
      action: "NOTIFICATIONS_READ_ALL",
      entityType: "Notification",
      entityId: req.user.id,
      newValue: { count },
    });
  }

  return success(res, { updated: count }, "All notifications marked as read");
});

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead };
