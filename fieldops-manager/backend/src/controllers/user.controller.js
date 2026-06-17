const prisma = require("../config/db");
const { hashPassword } = require("../utils/passwordUtils");
const { success, created, error, paginate } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");

const safeUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  isActive: u.isActive, orgId: u.orgId ?? null, createdAt: u.createdAt,
});

const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return error(res, "User not found", 404);
  return success(res, safeUser(user));
});

const getUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 50, search } = req.query;
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;
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
  const { name, email, role, password, orgId } = req.body;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return error(res, "Email already registered", 409);

  // Determine orgId: Admin uses their own org; Super_Admin must supply orgId in body
  let targetOrgId;
  if (req.user.role === "Super_Admin") {
    targetOrgId = orgId || null;
  } else {
    targetOrgId = req.user.orgId;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash, role, orgId: targetOrgId },
  });

  if (role === "Engineer") {
    await prisma.engineerStock.deleteMany({ where: { engineerId: user.id } });
  }

  await writeAudit({ req, action: "USER_CREATED", entityType: "User", entityId: user.id, newValue: { email: user.email, role: user.role, orgId: user.orgId } });
  return created(res, safeUser(user), "User created successfully");
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return error(res, "User not found", 404);
  if (req.user.role !== "Super_Admin" && user.orgId !== req.user.orgId) return error(res, "User not found", 404);

  const updated = await prisma.user.update({ where: { id }, data: { name, role } });
  await writeAudit({ req, action: "USER_UPDATED", entityType: "User", entityId: id, oldValue: { name: user.name, role: user.role }, newValue: { name, role } });
  return success(res, safeUser(updated), "User updated");
});

const resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return error(res, "User not found", 404);
  if (req.user.role !== "Super_Admin" && user.orgId !== req.user.orgId) return error(res, "User not found", 404);

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  await writeAudit({ req, action: "PASSWORD_RESET", entityType: "User", entityId: id });
  return success(res, {}, "Password updated");
});

const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return error(res, "User not found", 404);
  if (req.user.role !== "Super_Admin" && user.orgId !== req.user.orgId) return error(res, "User not found", 404);

  const updated = await prisma.user.update({ where: { id }, data: { isActive } });
  await writeAudit({ req, action: isActive ? "USER_ENABLED" : "USER_DISABLED", entityType: "User", entityId: id, oldValue: { isActive: user.isActive }, newValue: { isActive } });
  return success(res, safeUser(updated), `User ${isActive ? "activated" : "deactivated"}`);
});

const getUserEngineers = asyncHandler(async (req, res) => {
  const where = { role: "Engineer", isActive: true };
  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;

  const engineers = await prisma.user.findMany({ where, orderBy: { name: "asc" } });
  return success(res, engineers.map(safeUser));
});

const getTeamLeaders = asyncHandler(async (req, res) => {
  const where = { role: "Team_Leader", isActive: true };
  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;

  const tls = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return success(res, tls);
});

// Super_Admin only: assign or move a user to a different organisation
const assignOrganisation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { orgId } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return error(res, "User not found", 404);

  if (orgId) {
    const org = await prisma.organisation.findUnique({ where: { id: orgId } });
    if (!org) return error(res, "Organisation not found", 404);
    if (!org.isActive) return error(res, "Organisation is inactive", 400);
  }

  const updated = await prisma.user.update({ where: { id }, data: { orgId: orgId || null } });
  return success(res, safeUser(updated), "User organisation updated");
});

module.exports = {
  getMe, getUsers, createUser, updateUser, resetPassword,
  updateStatus, getUserEngineers, getTeamLeaders, assignOrganisation,
};
