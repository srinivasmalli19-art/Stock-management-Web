const prisma = require("../config/db");
const { success, created, error, paginate } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

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
      include: { _count: { select: { users: true } } },
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
  const { name, siteCode } = req.body;

  const existing = await prisma.organisation.findUnique({ where: { siteCode: siteCode.toUpperCase() } });
  if (existing) return error(res, "Site code already in use", 409);

  const org = await prisma.organisation.create({
    data: { name, siteCode: siteCode.toUpperCase() },
  });

  return created(res, org, "Organisation created");
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
