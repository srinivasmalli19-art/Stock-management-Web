const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

function generateRequestId() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LP-${date}-${rand}`;
}

const getLpRequests = asyncHandler(async (req, res) => {
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;
  if (req.user.role === "Team_Leader") where.tlEmail = req.user.email;

  const requests = await prisma.lpRequest.findMany({
    where,
    include: { claim: true },
    orderBy: { createdAt: "desc" },
  });
  return success(res, requests);
});

const createLpRequest = asyncHandler(async (req, res) => {
  const { jobId, spareCost, serviceCost, description } = req.body;
  const orgId = req.user.orgId;

  const spare = Number(spareCost) || 0;
  const service = Number(serviceCost) || 0;

  const request = await prisma.lpRequest.create({
    data: {
      requestId: generateRequestId(),
      jobId,
      spareCost: spare,
      serviceCost: service,
      totalCost: spare + service,
      description,
      tlEmail: req.user.email,
      requestDate: new Date(),
      status: "LP_PENDING_ADMIN_APPROVAL",
      orgId,
    },
    include: { claim: true },
  });
  return created(res, request, "LP request submitted for Admin approval");
});

const adminApproveLp = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body;

  const request = await prisma.lpRequest.findUnique({ where: { id } });
  if (!request) return error(res, "LP request not found", 404);
  if (req.user.role !== "Super_Admin" && request.orgId !== req.user.orgId) return error(res, "LP request not found", 404);
  if (request.status !== "LP_PENDING_ADMIN_APPROVAL")
    return error(res, "Only pending LP requests can be reviewed", 400);

  const newStatus = action === "approve" ? "CLAIM_PENDING" : "LP_REJECTED";

  const updated = await prisma.lpRequest.update({
    where: { id },
    data: {
      status: newStatus,
      adminRemarks: remarks || null,
      approvedBy: req.user.email,
      approvedAt: new Date(),
    },
    include: { claim: true },
  });

  const msg = action === "approve"
    ? "LP request approved. Team Leader can now raise a claim."
    : "LP request rejected.";
  return success(res, updated, msg);
});

module.exports = { getLpRequests, createLpRequest, adminApproveLp };
