const prisma = require("../config/db");
const { success, created, error, paginate } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { hashPassword } = require("../utils/passwordUtils");
const { writeAudit } = require("../utils/auditService");

const safeUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  isActive: u.isActive, orgId: u.orgId ?? null, createdAt: u.createdAt,
});

const getOrganisations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const where = {};
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [orgs, total] = await Promise.all([
    prisma.organisation.findMany({
      where,
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: { name: "asc" },
      include: {
        _count: { select: { users: true } },
        users: { where: { role: "Admin" }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.organisation.count({ where }),
  ]);

  return success(res, orgs, "Organisations fetched", 200, paginate(total, page, limit));
});

const getOrganisation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const org = await prisma.organisation.findUnique({
    where: { id },
    include: { _count: { select: { users: true, skus: true, lpRequests: true } } },
  });
  if (!org) return error(res, "Organisation not found", 404);
  return success(res, org);
});

const createOrganisation = asyncHandler(async (req, res) => {
  const { name, siteCode, adminName, adminEmail, password } = req.body;

  const [existingOrg, existingUser] = await Promise.all([
    prisma.organisation.findUnique({ where: { siteCode: siteCode.toUpperCase() } }),
    prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } }),
  ]);
  if (existingOrg) return error(res, "Site code already in use", 409);
  if (existingUser) return error(res, "Admin email already registered", 409);

  const passwordHash = await hashPassword(password);

  let org, admin;
  await prisma.$transaction(async (tx) => {
    org = await tx.organisation.create({
      data: { name, siteCode: siteCode.toUpperCase() },
    });
    admin = await tx.user.create({
      data: {
        name: adminName,
        email: adminEmail.toLowerCase(),
        passwordHash,
        role: "Admin",
        orgId: org.id,
        isActive: true,
      },
    });
  });

  await writeAudit({ req, action: "ORGANISATION_CREATED", entityType: "Organisation", entityId: org.id, newValue: { name, siteCode: siteCode.toUpperCase(), adminUserId: admin.id } });
  await writeAudit({ req, action: "USER_CREATED", entityType: "User", entityId: admin.id, newValue: { email: admin.email, role: "Admin", orgId: org.id } });

  return created(
    res,
    { organisation: { id: org.id, name: org.name, siteCode: org.siteCode, isActive: org.isActive, createdAt: org.createdAt }, admin: safeUser(admin) },
    "Organisation and Admin created successfully"
  );
});

const updateOrganisation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, isActive } = req.body;

  const org = await prisma.organisation.findUnique({ where: { id } });
  if (!org) return error(res, "Organisation not found", 404);

  const updated = await prisma.organisation.update({
    where: { id },
    data: { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
  });

  return success(res, updated, "Organisation updated");
});

module.exports = { getOrganisations, getOrganisation, createOrganisation, updateOrganisation };
