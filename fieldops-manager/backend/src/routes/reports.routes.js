const express = require("express");
const { getPLReport, downloadPLCsv, getSupplierReport, downloadSupplierCsv } = require("../controllers/reports.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

router.get("/pl", authorize("Admin"), getPLReport);
router.get("/pl/csv", authorize("Admin"), downloadPLCsv);
router.get("/purchase/supplier", authorize("Admin", "Store_Manager"), getSupplierReport);
router.get("/purchase/supplier/csv", authorize("Admin", "Store_Manager"), downloadSupplierCsv);

module.exports = router;
