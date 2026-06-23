const express = require("express");
const Joi = require("joi");
const {
  submitAttendance,
  getMyAttendance,
  getAllStaffAttendance,
  approveAttendance,
  rejectAttendance,
  resubmitAttendance,
} = require("../controllers/staffAttendance.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

const submitSchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  attendanceStatus: Joi.string()
    .valid("Present", "Absent", "Half_Day", "Leave")
    .required(),
  remarks: Joi.string().max(500).allow("", null).optional(),
});

const rejectSchema = Joi.object({
  rejectedReason: Joi.string().max(500).allow("", null).optional(),
});

// TL / SM routes
router.post("/", authorize("Team_Leader", "Store_Manager"), validate(submitSchema), submitAttendance);
router.get("/me", authorize("Team_Leader", "Store_Manager"), getMyAttendance);

// Admin / Super_Admin routes
router.get("/", authorize("Admin", "Super_Admin"), getAllStaffAttendance);
router.patch("/:id/approve", authorize("Admin", "Super_Admin"), approveAttendance);
router.patch("/:id/reject", authorize("Admin", "Super_Admin"), validate(rejectSchema), rejectAttendance);

// TL / SM: resubmit rejected record
router.patch("/:id/resubmit", authorize("Team_Leader", "Store_Manager"), resubmitAttendance);

module.exports = router;
