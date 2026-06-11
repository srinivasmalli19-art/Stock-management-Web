const express = require("express");
const rateLimit = require("express-rate-limit");
const Joi = require("joi");
const { login, logout, refresh } = require("../controllers/auth.controller");
const validate = require("../middlewares/validate");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/logout", logout);
router.post("/refresh", refresh);

module.exports = router;
