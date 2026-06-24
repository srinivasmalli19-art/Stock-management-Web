const express = require("express");
const Joi = require("joi");
const { getAllSkus, createSku, updateSku } = require("../controllers/sku.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

const createSchema = Joi.object({
  code: Joi.string().pattern(/^SKU-\d+$/i).required(),
  name: Joi.string().min(2).required(),
  lowStockAlert: Joi.number().integer().min(0).optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  lowStockAlert: Joi.number().integer().min(0).optional(),
});

router.get("/", getAllSkus);
// Store_Manager can create; Admin can create/edit/delete
router.post("/", authorize("Admin", "Store_Manager"), validate(createSchema), createSku);
router.put("/:id", authorize("Admin"), validate(updateSchema), updateSku);

module.exports = router;
