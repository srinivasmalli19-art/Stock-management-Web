const express = require("express");
const { getMainInventory, getEngineerStock, getMyStock, downloadInventoryCsv } = require("../controllers/inventory.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

router.get("/main", authorize("Admin", "Store_Manager"), getMainInventory);
router.get("/main/csv", authorize("Admin", "Store_Manager"), downloadInventoryCsv);
router.get("/engineer/:id", authorize("Admin", "Store_Manager"), getEngineerStock);
router.get("/my-stock", authorize("Engineer"), getMyStock);

module.exports = router;
