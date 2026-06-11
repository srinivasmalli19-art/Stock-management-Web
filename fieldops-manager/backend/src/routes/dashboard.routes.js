const express = require("express");
const { engineerDashboard, teamLeaderDashboard, storeDashboard, adminDashboard } = require("../controllers/dashboard.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);

router.get("/engineer", authorize("Engineer"), engineerDashboard);
router.get("/team-leader", authorize("Team_Leader"), teamLeaderDashboard);
router.get("/store", authorize("Store_Manager"), storeDashboard);
router.get("/admin", authorize("Admin"), adminDashboard);

module.exports = router;
