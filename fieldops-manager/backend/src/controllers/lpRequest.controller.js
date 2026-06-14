const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");

const getLpRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = {};

  // Engineer sees only their own submitted requests
  if (req.user.role === "Engineer") where.engineerEmail = req.user.email;
  // TL sees all requests assigned to them (both TL-created and engineer-submitted)
  else if (req.user.role === "Team_Leader") where.tlEmail = req.user.email;
  // Store_Manager and Admin see all

  if (status) where.status = status;

  const requests = await prisma.lpRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return success(res, requests);
});

const createLpRequest = asyncHandler(async (req, res) => {
  const { jobId, spareCost, serviceCost, date, tlEmail: bodyTlEmail } = req.body;
  const isEngineer = req.user.role === "Engineer";

  if (isEngineer && !bodyTlEmail) {
    return error(res, "Team Leader email is required for engineer submissions", 400);
  }

  const request = await prisma.lpRequest.create({
    data: {
      jobId,
      spareCost: Number(spareCost) || 0,
      serviceCost: Number(serviceCost) || 0,
      tlEmail: isEngineer ? bodyTlEmail : req.user.email,
      engineerEmail: isEngineer ? req.user.email : null,
      date: new Date(date),
      status: "Pending",
    },
  });
  return created(res, request, "LP request submitted");
});

// Workflow: Engineer → Pending → TL approves → Claim_Pending → Store → Claim_Submitted → Claim_Forwarded → Admin → Claim_Approved
// Legacy TL-created requests: Store can also advance from Pending (backward compatible)
const STATUS_TRANSITIONS = {
  Team_Leader: { Pending: "Claim_Pending" },
  Store_Manager: {
    Pending: "Claim_Pending",
    Claim_Pending: "Claim_Submitted",
    Claim_Submitted: "Claim_Forwarded",
  },
  Admin: { Claim_Forwarded: "Claim_Approved" },
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

  // TL can only act on requests assigned to them
  if (role === "Team_Leader" && request.tlEmail !== req.user.email) {
    return error(res, "This request is not assigned to you", 403);
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
