const express = require("express");
const { getAttendance, getAttendanceSummary, getAttendanceAll, downloadAttendanceCsv } = require("../controllers/attendance.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

router.get("/", authorize("Admin", "Team_Leader"), getAttendance);
router.get("/summary", authorize("Admin", "Team_Leader"), getAttendanceSummary);
router.get("/all", authorize("Admin"), getAttendanceAll);
router.get("/csv", authorize("Admin"), downloadAttendanceCsv);

module.exports = router;
