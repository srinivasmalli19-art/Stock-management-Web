const express = require("express");
const Joi = require("joi");
const { getClaimRequests, createClaimRequest, validateClaim, adminApproveClaim } = require("../controllers/claimRequest.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

const createSchema = Joi.object({
  lpRequestId: Joi.string().required(),
  claimAmount: Joi.number().positive().required(),
  remarks: Joi.string().min(1).required(),
});

const storeSchema = Joi.object({
  action: Joi.string().valid("validate", "reject").required(),
  remarks: Joi.string().min(1).required(),
});

const adminSchema = Joi.object({
  action: Joi.string().valid("approve", "reject").required(),
  remarks: Joi.string().allow("", null).optional(),
});

router.get("/", authorize("Team_Leader", "Store_Manager", "Admin"), getClaimRequests);
router.post("/", authorize("Team_Leader"), validate(createSchema), createClaimRequest);
router.patch("/:id/validate", authorize("Store_Manager"), validate(storeSchema), validateClaim);
router.patch("/:id/approve", authorize("Admin"), validate(adminSchema), adminApproveClaim);

module.exports = router;
