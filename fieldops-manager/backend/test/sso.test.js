/**
 * SLC sign-in (Keycloak) for Stock Management admins.
 * Run: node --test test/
 *
 * A tiny local "identity provider" serves discovery + JWKS and signs tokens
 * with a test key; Prisma is replaced by an in-memory fake. No database or
 * Keycloak needed.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { generateKeyPair, exportJWK, SignJWT } = require("jose");

// ---- fake Prisma (installed before the app code is required) -----------------
const db = { users: [], orgs: [], refreshTokens: [], audits: [] };
const withOrg = (u) => (u ? { ...u, org: db.orgs.find((o) => o.id === u.orgId) || null } : null);
const matches = (row, where) =>
  Object.entries(where).every(([k, v]) => {
    if (k === "user") return matches(db.users.find((u) => u.id === row.userId) || {}, v);
    return row[k] === v;
  });
const fakePrisma = {
  user: {
    findUnique: async ({ where }) => withOrg(db.users.find((u) => matches(u, where))),
    update: async ({ where, data }) => {
      const u = db.users.find((x) => matches(x, where));
      Object.assign(u, data);
      return withOrg(u);
    },
  },
  refreshToken: {
    create: async ({ data }) => {
      const row = { id: String(db.refreshTokens.length + 1), isRevoked: false, ...data };
      db.refreshTokens.push(row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const rows = db.refreshTokens.filter((r) => matches(r, where));
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    },
  },
  auditLog: { create: async ({ data }) => db.audits.push(data) },
};
require.cache[require.resolve("../src/config/db")] = { id: "db", filename: "db", loaded: true, exports: fakePrisma };

// ---- local identity provider --------------------------------------------------
let idp;
let issuer;
let key;
let jwk;
let api;
let apiUrl;

async function accessToken(claims, { audience = "stock-admin", signWith } = {}) {
  return new SignJWT({ email_verified: true, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(signWith || key);
}

async function logoutToken(claims, opts = {}) {
  return new SignJWT({ events: { "http://schemas.openid.net/event/backchannel-logout": {} }, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(issuer)
    .setAudience(opts.audience || "stock-admin")
    .setIssuedAt()
    .sign(key);
}

const post = (p, body, type = "json") =>
  fetch(`${apiUrl}${p}`, {
    method: "POST",
    headers: { "Content-Type": type === "json" ? "application/json" : "application/x-www-form-urlencoded" },
    body: type === "json" ? JSON.stringify(body) : new URLSearchParams(body).toString(),
  });

before(async () => {
  const pair = await generateKeyPair("RS256");
  key = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  idp = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/realms/slc/.well-known/openid-configuration") {
      return res.end(JSON.stringify({ issuer, jwks_uri: `${issuer}/protocol/openid-connect/certs` }));
    }
    if (req.url === "/realms/slc/protocol/openid-connect/certs") return res.end(JSON.stringify({ keys: [jwk] }));
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise((r) => idp.listen(0, "127.0.0.1", r));
  issuer = `http://127.0.0.1:${idp.address().port}/realms/slc`;

  process.env.SSO_ISSUER_URL = issuer;
  process.env.JWT_ACCESS_SECRET = "test-access";
  process.env.JWT_REFRESH_SECRET = "test-refresh";
  const express = require("express");
  const cookieParser = require("cookie-parser");
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", require(path.join("..", "src", "routes", "auth.routes")));
  api = http.createServer(app);
  await new Promise((r) => api.listen(0, "127.0.0.1", r));
  apiUrl = `http://127.0.0.1:${api.address().port}`;

  db.orgs.push({ id: "org1", isActive: true }, { id: "org2", isActive: false });
  db.users.push(
    { id: "sa", email: "owner@slc.test", name: "Owner", role: "Super_Admin", orgId: null, isActive: true, ssoSubject: null },
    { id: "ad", email: "admin@slc.test", name: "Site Admin", role: "Admin", orgId: "org1", isActive: true, ssoSubject: null },
    { id: "ad2", email: "admin2@slc.test", name: "Closed Org Admin", role: "Admin", orgId: "org2", isActive: true, ssoSubject: null },
    { id: "eng", email: "eng@slc.test", name: "Engineer", role: "Engineer", orgId: "org1", isActive: true, ssoSubject: null },
  );
});

after(async () => {
  await new Promise((r) => api.close(r));
  await new Promise((r) => idp.close(r));
});

test("advertises SLC sign-in", async () => {
  const res = await fetch(`${apiUrl}/api/auth/sso/config`);
  const body = await res.json();
  assert.equal(body.data.enabled, true);
  assert.equal(body.data.clientId, "stock-admin");
});

test("a Super Admin signs in, is linked by verified email and gets the app's own tokens", async () => {
  const res = await post("/api/auth/sso", { accessToken: await accessToken({ sub: "kc-owner", email: "owner@slc.test", roles: ["super_admin"], sid: "s1" }) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.user.role, "Super_Admin");
  assert.ok(body.data.accessToken);
  assert.match(res.headers.get("set-cookie"), /refreshToken=/);
  assert.equal(db.users.find((u) => u.id === "sa").ssoSubject, "kc-owner");
  assert.equal(db.refreshTokens.at(-1).ssoSid, "s1");
  assert.equal(db.audits.at(-1).action, "SSO_LOGIN");
});

test("an org Admin keeps their organisation", async () => {
  const res = await post("/api/auth/sso", { accessToken: await accessToken({ sub: "kc-admin", email: "admin@slc.test", roles: ["manager"] }) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.user.orgId, "org1");
});

test("SLC 'manager' role cannot open a Super_Admin account", async () => {
  db.users.find((u) => u.id === "sa").ssoSubject = null;
  const res = await post("/api/auth/sso", { accessToken: await accessToken({ sub: "kc-owner", email: "owner@slc.test", roles: ["manager"] }) });
  assert.equal(res.status, 403);
});

test("rejects: no admin role, unknown account, field roles, closed org, unverified email", async () => {
  const cases = [
    [{ sub: "x1", email: "admin@slc.test", roles: ["viewer"] }, 403],
    [{ sub: "x2", email: "nobody@slc.test", roles: ["manager"] }, 403],
    [{ sub: "x3", email: "eng@slc.test", roles: ["manager"] }, 403],
    [{ sub: "x4", email: "admin2@slc.test", roles: ["manager"] }, 403],
    [{ sub: "x5", email: "owner@slc.test", roles: ["super_admin"], email_verified: false }, 403],
  ];
  for (const [claims, status] of cases) {
    const res = await post("/api/auth/sso", { accessToken: await accessToken(claims) });
    assert.equal(res.status, status, JSON.stringify(claims));
  }
});

test("rejects tokens for another app, forged tokens and garbage", async () => {
  const other = await accessToken({ sub: "kc-admin", email: "admin@slc.test", roles: ["manager"] }, { audience: "pasumithra-admin" });
  const { privateKey } = await generateKeyPair("RS256");
  const forged = await accessToken({ sub: "kc-admin", email: "admin@slc.test", roles: ["manager"] }, { signWith: privateKey });
  for (const token of [other, forged, "x".repeat(40)]) {
    assert.equal((await post("/api/auth/sso", { accessToken: token })).status, 401);
  }
});

test("central sign-out revokes this app's refresh tokens for that session", async () => {
  await post("/api/auth/sso", { accessToken: await accessToken({ sub: "kc-admin", email: "admin@slc.test", roles: ["manager"], sid: "s-admin" }) });
  const row = db.refreshTokens.find((r) => r.ssoSid === "s-admin");
  assert.equal(row.isRevoked, false);

  const bad = await post("/api/auth/sso/backchannel-logout", { logout_token: await logoutToken({ sid: "s-admin" }, { audience: "other" }) }, "form");
  assert.equal(bad.status, 400);
  assert.equal(row.isRevoked, false);

  const ok = await post("/api/auth/sso/backchannel-logout", { logout_token: await logoutToken({ sub: "kc-admin", sid: "s-admin" }) }, "form");
  assert.equal(ok.status, 200);
  assert.equal(row.isRevoked, true);
});

test("logout by subject revokes every SSO session of that person", async () => {
  await post("/api/auth/sso", { accessToken: await accessToken({ sub: "kc-admin", email: "admin@slc.test", roles: ["manager"], sid: "s-a" }) });
  await post("/api/auth/sso", { accessToken: await accessToken({ sub: "kc-admin", email: "admin@slc.test", roles: ["manager"], sid: "s-b" }) });
  const res = await post("/api/auth/sso/backchannel-logout", { logout_token: await logoutToken({ sub: "kc-admin" }) }, "form");
  assert.equal(res.status, 200);
  assert.ok(db.refreshTokens.filter((r) => r.userId === "ad").every((r) => r.isRevoked));
});
