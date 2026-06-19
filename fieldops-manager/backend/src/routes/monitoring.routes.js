const express = require("express");
const { getMonitoringStats } = require("../controllers/monitoring.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);
router.get("/", authorize("Super_Admin"), getMonitoringStats);

module.exports = router;
