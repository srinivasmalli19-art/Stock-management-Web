const express = require("express");
const Joi = require("joi");
const { getRequests, createRequest, approveRequest, rejectRequest, submitRevoke, resubmitRequest } = require("../controllers/stockRequest.controller");
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
});

router.get("/", getRequests);
router.post("/", authorize("Engineer"), validate(createSchema), createRequest);
router.patch("/:id/approve", authorize("Store_Manager"), approveRequest);
router.patch("/:id/reject", authorize("Store_Manager"), rejectRequest);
router.post("/:id/revoke", authorize("Store_Manager"), submitRevoke);
router.patch("/:id/resubmit", authorize("Engineer"), resubmitRequest);

module.exports = router;
