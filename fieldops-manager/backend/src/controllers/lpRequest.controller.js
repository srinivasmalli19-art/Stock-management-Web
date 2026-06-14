const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

const getLpRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = {};

  if (req.user.role === "Team_Leader") where.tlEmail = req.user.email;
  if (status) where.status = status;

  const requests = await prisma.lpRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return success(res, requests);
});

const createLpRequest = asyncHandler(async (req, res) => {
  const { jobId, spareCost, serviceCost, date } = req.body;

  const request = await prisma.lpRequest.create({
    data: {
      jobId,
      spareCost: Number(spareCost) || 0,
      serviceCost: Number(serviceCost) || 0,
      tlEmail: req.user.email,
      date: new Date(date),
      status: "Pending",
    },
  });
  return created(res, request, "LP request submitted");
});

// Which statuses each role can advance from
const STATUS_TRANSITIONS = {
  Store_Manager: {
    Pending: "Claim_Pending",
    Claim_Pending: "Claim_Submitted",
    Claim_Submitted: "Claim_Forwarded",
  },
  Admin: {
    Claim_Forwarded: "Claim_Approved",
  },
};

const TERMINAL_STATUSES = new Set(["Claim_Approved", "Rejected"]);

const updateLpStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, note } = req.body;
  const role = req.user.role;

  const request = await prisma.lpRequest.findUnique({ where: { id } });
  if (!request) return error(res, "LP request not found", 404);
  if (TERMINAL_STATUSES.has(request.status)) {
    return error(res, "Request is already in a final status", 400);
  }

  let newStatus;
  if (action === "reject") {
    newStatus = "Rejected";
  } else {
    const transitions = STATUS_TRANSITIONS[role] || {};
    newStatus = transitions[request.status];
    if (!newStatus) {
      return error(res, `Cannot advance from '${request.status}' as ${role}`, 400);
    }
  }

  const updated = await prisma.lpRequest.update({
    where: { id },
    data: { status: newStatus, note: note || request.note },
  });
  return success(res, updated, `Status updated to ${newStatus.replace(/_/g, " ")}`);
});

module.exports = { getLpRequests, createLpRequest, updateLpStatus };
