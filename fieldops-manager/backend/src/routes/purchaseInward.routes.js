const express = require("express");
const Joi = require("joi");
const { getInwards, createInward, approveInward, rejectInward } = require("../controllers/purchaseInward.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

const createSchema = Joi.object({
  skuId: Joi.string().required(),
  qty: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().min(0).required(),
  vendor: Joi.string().min(2).required(),
  invoiceNo: Joi.string().optional(),
  date: Joi.string().isoDate().required(),
});

router.get("/", authorize("Store_Manager", "Admin"), getInwards);
router.post("/", authorize("Store_Manager"), validate(createSchema), createInward);
router.patch("/:id/approve", authorize("Admin"), approveInward);
router.patch("/:id/reject", authorize("Admin"), rejectInward);

module.exports = router;
