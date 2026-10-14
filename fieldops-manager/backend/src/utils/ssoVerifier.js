/**
 * Verifies tokens issued by the SLC central identity provider (Keycloak).
 *
 * - Access tokens: signature (realm JWKS), issuer, audience = this app's client
 *   id, expiry. Used when an admin signs in with their SLC Account.
 * - Back-channel logout tokens (OpenID Connect Back-Channel Logout 1.0): used
 *   when an admin is signed out centrally, e.g. disabled in SLC Central Admin.
 */
const { createRemoteJWKSet, jwtVerify } = require("jose");

const BACKCHANNEL_LOGOUT_EVENT = "http://schemas.openid.net/event/backchannel-logout";

/**
 * Map SLC (Keycloak) roles for this app to the local roles they allow an
 * account to hold. The local account keeps its own role and organisation; the
 * SLC role only decides whether that account may sign in through SSO.
 */
const SSO_ROLE_GRANTS = {
  super_admin: ["Super_Admin", "Admin"],
  // Named "manager", not "admin": Keycloak refuses to let SLC Central Admin
  // grant a client role called "admin" (it clashes with Keycloak's own role).
  manager: ["Admin"],
};

function allowedLocalRoles(ssoRoles) {
  const allowed = new Set();
  for (const role of Array.isArray(ssoRoles) ? ssoRoles : []) {
    for (const local of SSO_ROLE_GRANTS[role] || []) allowed.add(local);
  }
  return allowed;
}

function createSsoVerifier({ issuerUrl, clientId, fetchImpl = fetch }) {
  let jwks = null;
  let issuer = null;

  async function init() {
    if (jwks) return;
    const res = await fetchImpl(`${issuerUrl}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error(`SSO discovery failed (${res.status})`);
    const meta = await res.json();
    issuer = meta.issuer;
    jwks = createRemoteJWKSet(new URL(meta.jwks_uri));
  }

  async function verifyAccessToken(token) {
    await init();
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: clientId });
    // Must have been issued TO this app (authorized party), not merely list it
    // in `aud`: a token from another SLC app could otherwise be replayed here.
    if (payload.azp !== clientId) throw new Error("Token was issued to another app");
    if (typeof payload.sub !== "string") throw new Error("Token has no subject");
    return payload;
  }

  async function verifyLogoutToken(token) {
    await init();
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: clientId,
      requiredClaims: ["iat"],
      maxTokenAge: "10m",
    });
    const hasEvent =
      payload.events && typeof payload.events === "object" && typeof payload.events[BACKCHANNEL_LOGOUT_EVENT] === "object";
    const sub = typeof payload.sub === "string" ? payload.sub : undefined;
    const sid = typeof payload.sid === "string" ? payload.sid : undefined;
    if (!hasEvent || payload.nonce !== undefined || (!sub && !sid)) {
      throw new Error("Invalid logout token");
    }
    return { sub, sid };
  }

  return { verifyAccessToken, verifyLogoutToken };
}

let defaultVerifier = null;

/** Shared verifier built from env, or null when SSO is not configured. */
function getSsoVerifier() {
  const env = require("../config/env");
  if (!env.SSO_ISSUER_URL) return null;
  if (!defaultVerifier) {
    defaultVerifier = createSsoVerifier({ issuerUrl: env.SSO_ISSUER_URL, clientId: env.SSO_CLIENT_ID });
  }
  return defaultVerifier;
}

module.exports = { createSsoVerifier, getSsoVerifier, allowedLocalRoles, SSO_ROLE_GRANTS };
