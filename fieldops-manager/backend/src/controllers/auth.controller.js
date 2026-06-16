const prisma = require("../config/db");
const { comparePassword } = require("../utils/passwordUtils");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, getRefreshTokenExpiry } = require("../utils/tokenUtils");
const { success, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

// sameSite "none" required for cross-domain cookie (frontend and backend on different domains)
// secure must be true when sameSite is "none"
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) return error(res, "Invalid credentials", 401);

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return error(res, "Invalid credentials", 401);

  const payload = { id: user.id, email: user.email, role: user.role, name: user.name, orgId: user.orgId ?? null };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ id: user.id });

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt: getRefreshTokenExpiry() },
  });

  res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);

  return success(res, { accessToken, user: payload }, "Login successful");
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: { isRevoked: true },
    });
  }
  res.clearCookie("refreshToken", { path: "/" });
  return success(res, {}, "Logged out successfully");
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return error(res, "No refresh token", 401);

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return error(res, "Invalid or expired refresh token", 401);
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
    return error(res, "Refresh token revoked or expired", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.isActive) return error(res, "User not found or inactive", 401);

  // Rotate refresh token
  await prisma.refreshToken.update({ where: { token }, data: { isRevoked: true } });

  const payload = { id: user.id, email: user.email, role: user.role, name: user.name, orgId: user.orgId ?? null };
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken({ id: user.id });

  await prisma.refreshToken.create({
    data: { userId: user.id, token: newRefreshToken, expiresAt: getRefreshTokenExpiry() },
  });

  res.cookie("refreshToken", newRefreshToken, COOKIE_OPTIONS);

  return success(res, { accessToken: newAccessToken }, "Token refreshed");
});

module.exports = { login, logout, refresh };
