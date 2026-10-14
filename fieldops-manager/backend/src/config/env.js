const required = (key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return process.env[key];
};

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_in_production",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_change_in_production",
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || "15m",
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || "7d",

  // ---- SLC central sign-in (Keycloak / OpenID Connect) ----------------------
  // When SSO_ISSUER_URL is set, Super_Admin and Admin accounts can sign in with
  // their SLC Account. Example: https://id.slcvet.com/realms/slc
  SSO_ISSUER_URL: (process.env.SSO_ISSUER_URL || "").replace(/\/$/, ""),
  // Keycloak client for this app; access tokens must carry it in `aud`.
  SSO_CLIENT_ID: process.env.SSO_CLIENT_ID || "stock-admin",
  // Label for the login button.
  SSO_PROVIDER_NAME: process.env.SSO_PROVIDER_NAME || "SLC Account",
  // When "true", Super_Admin / Admin can no longer use email + password.
  SSO_ENFORCE_FOR_ADMINS: process.env.SSO_ENFORCE_FOR_ADMINS === "true",
  // Upper bound for an SSO session's refresh token (matches Keycloak's 10h max).
  SSO_SESSION_MAX_HOURS: parseInt(process.env.SSO_SESSION_MAX_HOURS || "10", 10),
};
