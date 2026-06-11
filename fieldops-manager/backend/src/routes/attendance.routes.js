const express = require("express");
const { getAttendance, getAttendanceSummary, downloadAttendanceCsv } = require("../controllers/attendance.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("Admin", "Team_Leader"), getAttendance);
router.get("/summary", authorize("Admin", "Team_Leader"), getAttendanceSummary);
router.get("/csv", authorize("Admin"), downloadAttendanceCsv);

module.exports = router;
