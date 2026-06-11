const express = require("express");
const { getRevokes, approveRevoke, rejectRevoke } = require("../controllers/revokeRequest.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);

router.get("/", authorize("Admin"), getRevokes);
router.patch("/:id/approve", authorize("Admin"), approveRevoke);
router.patch("/:id/reject", authorize("Admin"), rejectRevoke);

module.exports = router;
