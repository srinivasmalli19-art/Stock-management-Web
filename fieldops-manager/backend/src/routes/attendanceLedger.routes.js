const express = require("express");
const { getLedger, downloadLedgerCsv } = require("../controllers/attendanceLedger.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

router.get("/", authorize("Admin", "Super_Admin"), getLedger);
router.get("/csv", authorize("Admin", "Super_Admin"), downloadLedgerCsv);

module.exports = router;
