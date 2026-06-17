const express = require("express");
const { getAuditLogs } = require("../controllers/auditLog.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

router.get("/", authorize("Admin", "Super_Admin"), getAuditLogs);

module.exports = router;
