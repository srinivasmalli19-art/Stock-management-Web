const express = require("express");
const { getRevokes, approveRevoke, rejectRevoke } = require("../controllers/revokeRequest.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

router.get("/", authorize("Admin"), getRevokes);
router.patch("/:id/approve", authorize("Admin"), approveRevoke);
router.patch("/:id/reject", authorize("Admin"), rejectRevoke);

module.exports = router;
