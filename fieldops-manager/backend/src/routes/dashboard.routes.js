const express = require("express");
const { engineerDashboard, teamLeaderDashboard, storeDashboard, adminDashboard } = require("../controllers/dashboard.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

router.get("/engineer", authorize("Engineer"), engineerDashboard);
router.get("/team-leader", authorize("Team_Leader"), teamLeaderDashboard);
router.get("/store", authorize("Store_Manager"), storeDashboard);
router.get("/admin", authorize("Admin"), adminDashboard);

module.exports = router;
