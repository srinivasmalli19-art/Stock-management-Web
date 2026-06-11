const prisma = require("../config/db");
const { hashPassword } = require("../utils/passwordUtils");
const { success, created, error, paginate } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

const safeUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt });

const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return error(res, "User not found", 404);
  return success(res, safeUser(user));
});

const getUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 50, search } = req.query;
  const where = {};
  if (role) where.role = role;
  if (search) where.OR = [
    { name: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
  ];

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip: (page - 1) * limit, take: parseInt(limit), orderBy: { name: "asc" } }),
    prisma.user.count({ where }),
  ]);

  return success(res, users.map(safeUser), "Users fetched", 200, paginate(total, page, limit));
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, role, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return error(res, "Email already registered", 409);

  const passwordHash = await hashPassword(password || "password");
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash, role },
  });

  if (role === "Engineer") {
    await prisma.engineerStock.deleteMany({ where: { engineerId: user.id } });
  }

  return created(res, safeUser(user), "User created successfully");
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;

  const user = await prisma.user.update({ where: { id }, data: { name, role } });
  return success(res, safeUser(user), "User updated");
});

const resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  return success(res, {}, "Password updated");
});

const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await prisma.user.update({ where: { id }, data: { isActive } });
  return success(res, safeUser(user), `User ${isActive ? "activated" : "deactivated"}`);
});

const getUserEngineers = asyncHandler(async (req, res) => {
  const engineers = await prisma.user.findMany({
    where: { role: "Engineer", isActive: true },
    orderBy: { name: "asc" },
  });
  return success(res, engineers.map(safeUser));
});

module.exports = { getMe, getUsers, createUser, updateUser, resetPassword, updateStatus, getUserEngineers };
