/**
 * Sign-in with the SLC Account (central Keycloak) for Super_Admin and Admin.
 *
 * The browser signs in at Keycloak (Authorization Code + PKCE) and posts the
 * resulting access token here. We verify it, match it to an existing local
 * account (which keeps its own role and organisation), and issue this app's
 * usual access + refresh tokens, so every existing route and permission check
 * works unchanged. Field roles keep their email + password login.
 */
const prisma = require("../config/db");
const env = require("../config/env");
const { generateAccessToken, generateRefreshToken } = require("../utils/tokenUtils");
const { success, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");
const logger = require("../utils/logger");
const { getSsoVerifier, allowedLocalRoles } = require("../utils/ssoVerifier");

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};

const ssoConfig = (req, res) =>
  success(res, {
    enabled: Boolean(env.SSO_ISSUER_URL),
    issuer: env.SSO_ISSUER_URL || null,
    clientId: env.SSO_ISSUER_URL ? env.SSO_CLIENT_ID : null,
    providerName: env.SSO_PROVIDER_NAME,
    enforcedForAdmins: env.SSO_ENFORCE_FOR_ADMINS,
  });

const ssoLogin = asyncHandler(async (req, res) => {
  const verifier = getSsoVerifier();
  if (!verifier) return error(res, "SLC sign-in is not configured", 404);

  let claims;
  try {
    claims = await verifier.verifyAccessToken(req.body.accessToken);
  } catch (err) {
    logger.warn(`SSO token rejected: ${err.message}`);
    return error(res, "Your SLC sign-in could not be verified. Please try again.", 401);
  }

  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null;
  const allowed = allowedLocalRoles(claims.roles);
  if (allowed.size === 0) {
    return error(res, "Your SLC Account does not have admin access to Stock Management.", 403);
  }

  let user = await prisma.user.findUnique({ where: { ssoSubject: claims.sub }, include: { org: true } });
  if (!user && email) {
    const byEmail = await prisma.user.findUnique({ where: { email }, include: { org: true } });
    if (byEmail && !byEmail.ssoSubject) {
      if (claims.email_verified !== true) {
        return error(res, "Verify the email on your SLC Account before signing in here.", 403);
      }
      user = await prisma.user.update({ where: { id: byEmail.id }, data: { ssoSubject: claims.sub }, include: { org: true } });
      logger.info(`SSO linked user ${user.id} to subject ${claims.sub}`);
    }
  }

  // Accounts (and their organisation) are still created inside this app.
  if (!user) {
    return error(res, "No Stock Management admin account exists for this SLC Account. Ask your Super Admin to add you.", 403);
  }
  if (!user.isActive) return error(res, "Your account is deactivated.", 403);
  if (user.orgId && !user.org?.isActive) {
    return error(res, "Your organisation has been deactivated. Contact your Super Admin.", 403);
  }
  if (!allowed.has(user.role)) {
    return error(res, "Your SLC role does not allow signing in to this account.", 403);
  }

  const payload = { id: user.id, email: user.email, role: user.role, name: user.name, orgId: user.orgId ?? null };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id: user.id });
  const expiresAt = new Date(Date.now() + env.SSO_SESSION_MAX_HOURS * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt, ssoSid: typeof claims.sid === "string" ? claims.sid : null },
  });
  res.cookie("refreshToken", refreshToken, { ...COOKIE_OPTIONS, maxAge: expiresAt.getTime() - Date.now() });

  req.user = payload;
  await writeAudit({
    req,
    action: "SSO_LOGIN",
    entityType: "User",
    entityId: user.id,
    newValue: { via: "SLC Account", ssoRoles: claims.roles || [] },
  });

  return success(res, { accessToken, user: payload }, "Login successful");
});

/** Called server-to-server by Keycloak when an admin is signed out centrally. */
const ssoBackchannelLogout = async (req, res) => {
  res.set("Cache-Control", "no-store");
  const verifier = getSsoVerifier();
  const logoutToken = req.body?.logout_token;
  if (!verifier || typeof logoutToken !== "string") return res.status(400).json({ error: "invalid_request" });

  let claims;
  try {
    claims = await verifier.verifyLogoutToken(logoutToken);
  } catch (err) {
    logger.warn(`SSO back-channel logout rejected: ${err.message}`);
    return res.status(400).json({ error: "invalid_request" });
  }

  try {
    const where = claims.sid ? { ssoSid: claims.sid } : { user: { ssoSubject: claims.sub } };
    const result = await prisma.refreshToken.updateMany({ where: { ...where, isRevoked: false }, data: { isRevoked: true } });
    logger.info(`SSO back-channel logout revoked ${result.count} refresh token(s)`);
    return res.status(200).end();
  } catch (err) {
    logger.error(`SSO back-channel logout failed: ${err.message}`);
    return res.status(500).end();
  }
};

module.exports = { ssoConfig, ssoLogin, ssoBackchannelLogout };
