const express = require("express");
const Joi = require("joi");
const { getOrganisations, getOrganisation, createOrganisation, updateOrganisation } = require("../controllers/organisation.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);
router.use(authorize("Super_Admin"));

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  siteCode: Joi.string().pattern(/^[A-Za-z0-9-]+$/).min(2).max(20).required(),
  adminName: Joi.string().min(2).required(),
  adminEmail: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  isActive: Joi.boolean().optional(),
});

router.get("/", getOrganisations);
router.get("/:id", getOrganisation);
router.post("/", validate(createSchema), createOrganisation);
router.patch("/:id", validate(updateSchema), updateOrganisation);

module.exports = router;
