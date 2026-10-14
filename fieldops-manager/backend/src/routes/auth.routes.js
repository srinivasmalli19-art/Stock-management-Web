const express = require("express");
const rateLimit = require("express-rate-limit");
const Joi = require("joi");
const { login, logout, refresh, changePassword } = require("../controllers/auth.controller");
const { ssoConfig, ssoLogin, ssoBackchannelLogout } = require("../controllers/sso.controller");
const authenticate = require("../middlewares/authenticate");
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

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().min(1).required(),
  newPassword: Joi.string().min(8).required(),
});

// SLC sign-in requests carry a signed token, so they get their own, looser limit.
const ssoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: "Too many sign-in attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const ssoLoginSchema = Joi.object({
  accessToken: Joi.string().min(20).max(20000).required(),
});

router.post("/login", loginLimiter, validate(loginSchema), login);

// SLC central sign-in (Keycloak). See docs/SLC-SSO.md.
router.get("/sso/config", ssoConfig);
router.post("/sso", ssoLimiter, validate(ssoLoginSchema), ssoLogin);
router.post("/sso/backchannel-logout", express.urlencoded({ extended: false, limit: "20kb" }), ssoBackchannelLogout);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.patch("/change-password", authenticate, validate(changePasswordSchema), changePassword);

module.exports = router;
