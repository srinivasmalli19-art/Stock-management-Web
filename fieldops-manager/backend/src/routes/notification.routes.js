const express = require("express");
const { getNotifications, getUnreadCount, markRead, markAllRead } = require("../controllers/notification.controller");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();
router.use(authenticate);
// No requireOrg: Super_Admin (orgId=null) also receives notifications

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
// read-all MUST be declared before /:id/read to avoid "read-all" matching as an id param
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

module.exports = router;
