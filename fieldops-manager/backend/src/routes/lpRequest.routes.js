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
});

const updateSchema = Joi.object({
  action: Joi.string().valid("advance", "reject").required(),
  note: Joi.string().allow("", null).optional(),
});

router.get("/", authorize("Team_Leader", "Store_Manager", "Admin"), getLpRequests);
router.post("/", authorize("Team_Leader"), validate(createSchema), createLpRequest);
router.patch("/:id/status", authorize("Store_Manager", "Admin"), validate(updateSchema), updateLpStatus);

module.exports = router;
