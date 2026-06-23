const express = require("express");
const Joi = require("joi");
const { getReturnRequests, createReturnRequest, approveReturnRequest, rejectReturnRequest, resubmitReturnRequest } = require("../controllers/returnRequest.controller");
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
  note: Joi.string().optional().allow(""),
});

const rejectSchema = Joi.object({
  note: Joi.string().optional().allow(""),
});

const resubmitSchema = Joi.object({
  qty: Joi.number().integer().min(1).optional(),
  note: Joi.string().optional().allow(""),
});

router.get("/", getReturnRequests);
router.post("/", authorize("Engineer"), validate(createSchema), createReturnRequest);
router.patch("/:id/approve", authorize("Store_Manager"), approveReturnRequest);
router.patch("/:id/reject", authorize("Store_Manager"), validate(rejectSchema), rejectReturnRequest);
router.patch("/:id/resubmit", authorize("Engineer"), validate(resubmitSchema), resubmitReturnRequest);

module.exports = router;
