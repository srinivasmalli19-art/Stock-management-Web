const express = require("express");
const { engineerDashboard, teamLeaderDashboard, storeDashboard, adminDashboard, getActivity, getWidgets } = require("../controllers/dashboard.controller");
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

// Phase E — shared widget endpoints (requireOrg passes Super_Admin by design)
const ALL_ROLES = ["Engineer", "Team_Leader", "Store_Manager", "Admin", "Super_Admin"];
router.get("/activity", authorize(...ALL_ROLES), getActivity);
router.get("/widgets", authorize(...ALL_ROLES), getWidgets);

module.exports = router;
