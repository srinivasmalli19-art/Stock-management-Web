const express = require("express");
const Joi = require("joi");
const { getMe, getUsers, createUser, updateUser, resetPassword, updateStatus } = require("../controllers/user.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const validate = require("../middlewares/validate");

const router = express.Router();
router.use(authenticate);

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid("Engineer", "Team_Leader", "Store_Manager", "Admin").required(),
  password: Joi.string().min(4).optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  role: Joi.string().valid("Engineer", "Team_Leader", "Store_Manager", "Admin").optional(),
});

const pwSchema = Joi.object({ password: Joi.string().min(4).required() });
const statusSchema = Joi.object({ isActive: Joi.boolean().required() });

router.get("/me", getMe);
router.get("/", authorize("Admin"), getUsers);
router.post("/", authorize("Admin"), validate(createSchema), createUser);
router.put("/:id", authorize("Admin"), validate(updateSchema), updateUser);
router.patch("/:id/password", authorize("Admin"), validate(pwSchema), resetPassword);
router.patch("/:id/status", authorize("Admin"), validate(statusSchema), updateStatus);

module.exports = router;
