const prisma = require("../config/db");
const { success, created, error } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const { writeAudit } = require("../utils/auditService");
const { writeNotification, roleUserIds } = require("../utils/notificationService");

const getClaimRequests = asyncHandler(async (req, res) => {
  const where = {};

  if (req.user.role !== "Super_Admin") where.orgId = req.user.orgId;
  if (req.user.role === "Team_Leader") {
    where.lpRequest = { tlEmail: req.user.email };
  }

  const claims = await prisma.claimRequest.findMany({
    where,
    include: { lpRequest: true },
    orderBy: { createdAt: "desc" },
  });
  return success(res, claims);
});

const createClaimRequest = asyncHandler(async (req, res) => {
  const { lpRequestId, claimAmount, remarks } = req.body;
  const orgId = req.user.orgId;

  const lp = await prisma.lpRequest.findUnique({ where: { id: lpRequestId }, include: { claim: true } });
  if (!lp) return error(res, "LP Request not found", 404);
  if (lp.orgId !== orgId) return error(res, "LP Request not found", 404);
  if (lp.tlEmail !== req.user.email)
    return error(res, "You can only raise claims for your own LP requests", 403);
  if (lp.status !== "CLAIM_PENDING")
    return error(res, "Claim can only be raised after Admin approves the LP request", 400);
  if (lp.claim)
    return error(res, "A claim has already been raised for this LP request", 400);

  const amount = Number(claimAmount);
  if (isNaN(amount) || amount <= 0) {
    return error(res, "Claim amount must be a positive number", 400);
  }
  if (amount > lp.totalCost) {
    return error(res, `Claim amount (₹${amount}) cannot exceed LP total cost (₹${lp.totalCost})`, 400);
  }

  const claim = await prisma.claimRequest.create({
    data: {
      lpRequestId,
      claimAmount: amount,
      remarks,
      status: "CLAIM_VALIDATION_PENDING",
      orgId,
    },
    include: { lpRequest: true },
  });

  await writeAudit({ req, action: "CLAIM_CREATED", entityType: "ClaimRequest", entityId: claim.id, newValue: { lpRequestId, claimAmount: amount } });

  // Notify Store Managers to validate the claim
  const smIds = await roleUserIds(orgId, "Store_Manager");
  await writeNotification({
    userIds: smIds,
    orgId,
    title: "New Claim Awaiting Validation",
    message: `A claim of ₹${amount.toLocaleString("en-IN")} has been submitted for LP ${lp.requestId}. Please validate.`,
    type: "action_required",
    entityType: "ClaimRequest",
    entityId: claim.id,
  });

  return created(res, claim, "Claim request submitted for Store Manager validation");
});

const validateClaim = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body;

  const claim = await prisma.claimRequest.findUnique({ where: { id } });
  if (!claim) return error(res, "Claim not found", 404);
  if (req.user.role !== "Super_Admin" && claim.orgId !== req.user.orgId) return error(res, "Claim not found", 404);
  if (claim.status !== "CLAIM_VALIDATION_PENDING")
    return error(res, "Claim is not pending Store validation", 400);

  const newStatus = action === "validate" ? "CLAIM_ADMIN_APPROVAL_PENDING" : "CLAIM_REJECTED";

  const updated = await prisma.claimRequest.update({
    where: { id },
    data: {
      status: newStatus,
      validatedBy: req.user.email,
      validatedAt: new Date(),
      validationRemarks: remarks,
    },
    include: { lpRequest: true },
  });

  const validateAuditAction = action === "validate" ? "CLAIM_VALIDATED" : "CLAIM_REJECTED";
  await writeAudit({ req, action: validateAuditAction, entityType: "ClaimRequest", entityId: id, oldValue: { status: claim.status }, newValue: { status: newStatus, remarks: remarks || null } });

  // Notify the TL who submitted the claim
  const tlUser = await prisma.user.findUnique({
    where: { email: updated.lpRequest.tlEmail },
    select: { id: true },
  });
  if (tlUser) {
    await writeNotification({
      userIds: [tlUser.id],
      orgId: claim.orgId,
      title: action === "validate" ? "Claim Validated" : "Claim Rejected by Store",
      message: action === "validate"
        ? "Your claim has been validated by Store Manager and forwarded to Admin for final approval."
        : `Your claim was rejected by Store Manager.${remarks ? ` Reason: ${remarks}` : ""}`,
      type: action === "validate" ? "approved" : "rejected",
      entityType: "ClaimRequest",
      entityId: id,
    });
  }

  // If validated, also notify Admins for final approval
  if (action === "validate") {
    const adminIds = await roleUserIds(claim.orgId, "Admin");
    await writeNotification({
      userIds: adminIds,
      orgId: claim.orgId,
      title: "Claim Awaiting Final Approval",
      message: `A claim validated by Store Manager requires your final approval.`,
      type: "action_required",
      entityType: "ClaimRequest",
      entityId: id,
    });
  }

  const msg = action === "validate"
    ? "Claim validated and forwarded to Admin"
    : "Claim rejected by Store Manager";
  return success(res, updated, msg);
});

const adminApproveClaim = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, remarks } = req.body;

  const claim = await prisma.claimRequest.findUnique({ where: { id } });
  if (!claim) return error(res, "Claim not found", 404);
  if (req.user.role !== "Super_Admin" && claim.orgId !== req.user.orgId) return error(res, "Claim not found", 404);
  if (claim.status !== "CLAIM_ADMIN_APPROVAL_PENDING")
    return error(res, "Claim is not pending Admin approval", 400);

  const newStatus = action === "approve" ? "CLAIM_APPROVED" : "CLAIM_REJECTED";

  const updated = await prisma.claimRequest.update({
    where: { id },
    data: {
      status: newStatus,
      approvedBy: req.user.email,
      approvedAt: new Date(),
      approvalRemarks: remarks || null,
    },
    include: { lpRequest: true },
  });

  const adminAuditAction = action === "approve" ? "CLAIM_APPROVED" : "CLAIM_REJECTED";
  await writeAudit({ req, action: adminAuditAction, entityType: "ClaimRequest", entityId: id, oldValue: { status: claim.status }, newValue: { status: newStatus, remarks: remarks || null } });

  // Notify the TL who submitted the original LP request
  const tlUser = await prisma.user.findUnique({
    where: { email: updated.lpRequest.tlEmail },
    select: { id: true },
  });
  if (tlUser) {
    await writeNotification({
      userIds: [tlUser.id],
      orgId: claim.orgId,
      title: action === "approve" ? "Claim Approved" : "Claim Rejected by Admin",
      message: action === "approve"
        ? "Your claim has been approved by Admin."
        : `Your claim was rejected by Admin.${remarks ? ` Reason: ${remarks}` : ""}`,
      type: action === "approve" ? "approved" : "rejected",
      entityType: "ClaimRequest",
      entityId: id,
    });
  }

  return success(res, updated, action === "approve" ? "Claim approved!" : "Claim rejected");
});

module.exports = { getClaimRequests, createClaimRequest, validateClaim, adminApproveClaim };
