const express = require("express");
const Joi = require("joi");
const { getLpRequests, createLpRequest, updateLpStatus } = require("../controllers/lpRequest.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);

const createSchema = Joi.object({
  jobId: Joi.string().required(),
  spareCost: Joi.number().min(0).required(),
  serviceCost: Joi.number().min(0).required(),
  date: Joi.string().isoDate().required(),
  // Required when Engineer submits; omitted when TL creates their own
  tlEmail: Joi.string().email().optional().allow("", null),
});

const updateSchema = Joi.object({
  action: Joi.string().valid("advance", "reject").required(),
  note: Joi.string().allow("", null).optional(),
});

// GET: all four roles can fetch (each sees their scoped set)
router.get("/", authorize("Engineer", "Team_Leader", "Store_Manager", "Admin"), getLpRequests);
// POST: both Engineer and TL can create LP requests
router.post("/", authorize("Engineer", "Team_Leader"), validate(createSchema), createLpRequest);
// PATCH: TL reviews engineer requests; Store and Admin advance the claim pipeline
router.patch("/:id/status", authorize("Team_Leader", "Store_Manager", "Admin"), validate(updateSchema), updateLpStatus);

module.exports = router;
