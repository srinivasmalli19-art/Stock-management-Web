const express = require("express");
const Joi = require("joi");
const { getLogs, createLog, validateLog, rejectTL, approveLog, rejectAdmin } = require("../controllers/productivity.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);

const createSchema = Joi.object({
  date: Joi.string().isoDate().required(),
  callsClosed: Joi.number().integer().min(0).max(30).optional(),
  items: Joi.array().items(
    Joi.object({
      skuId: Joi.string().required(),
      qty: Joi.number().integer().min(1).required(),
      saleValue: Joi.number().min(0).optional(),
    })
  ).optional(),
});

router.get("/", getLogs);
router.post("/", authorize("Engineer"), validate(createSchema), createLog);
router.patch("/:id/validate", authorize("Team_Leader"), validateLog);
router.patch("/:id/reject-tl", authorize("Team_Leader"), rejectTL);
router.patch("/:id/approve", authorize("Admin"), approveLog);
router.patch("/:id/reject-admin", authorize("Admin"), rejectAdmin);

module.exports = router;
