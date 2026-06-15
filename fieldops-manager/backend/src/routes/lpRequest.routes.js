const express = require("express");
const Joi = require("joi");
const { getLpRequests, createLpRequest, adminApproveLp } = require("../controllers/lpRequest.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);

const createSchema = Joi.object({
  jobId: Joi.string().required(),
  spareCost: Joi.number().min(0).required(),
  serviceCost: Joi.number().min(0).required(),
  description: Joi.string().min(1).required(),
});

const reviewSchema = Joi.object({
  action: Joi.string().valid("approve", "reject").required(),
  remarks: Joi.string().allow("", null).optional(),
});

router.get("/", authorize("Team_Leader", "Admin"), getLpRequests);
router.post("/", authorize("Team_Leader"), validate(createSchema), createLpRequest);
router.patch("/:id/review", authorize("Admin"), validate(reviewSchema), adminApproveLp);

module.exports = router;
