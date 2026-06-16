const express = require("express");
const Joi = require("joi");
const {
  getMe, getUsers, createUser, updateUser, resetPassword,
  updateStatus, getTeamLeaders, assignOrganisation,
} = require("../controllers/user.controller");
const authenticate = require("../middlewares/authenticate");
const requireOrg = require("../middlewares/requireOrg");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);
router.use(requireOrg);

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid("Engineer", "Team_Leader", "Store_Manager", "Admin").required(),
  password: Joi.string().min(4).optional(),
  orgId: Joi.string().optional(), // Super_Admin may supply target org
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  role: Joi.string().valid("Engineer", "Team_Leader", "Store_Manager", "Admin").optional(),
});

const pwSchema = Joi.object({ password: Joi.string().min(4).required() });
const statusSchema = Joi.object({ isActive: Joi.boolean().required() });
const orgSchema = Joi.object({ orgId: Joi.string().allow(null).optional() });

router.get("/me", getMe);
router.get("/team-leaders", getTeamLeaders);
router.get("/", authorize("Admin", "Super_Admin"), getUsers);
router.post("/", authorize("Admin", "Super_Admin"), validate(createSchema), createUser);
router.put("/:id", authorize("Admin", "Super_Admin"), validate(updateSchema), updateUser);
router.patch("/:id/password", authorize("Admin", "Super_Admin"), validate(pwSchema), resetPassword);
router.patch("/:id/status", authorize("Admin", "Super_Admin"), validate(statusSchema), updateStatus);
router.patch("/:id/organisation", authorize("Super_Admin"), validate(orgSchema), assignOrganisation);

module.exports = router;
