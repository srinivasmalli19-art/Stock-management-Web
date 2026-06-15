export const STATUS_COLORS = {
  Pending: "badge-pending",
  Validated: "badge-validated",
  Approved: "badge-approved",
  Rejected: "badge-rejected",
  Present: "badge-present",
  Absent: "badge-absent",
  Low: "badge-low",
  Revoke_Pending: "badge-revoke-pending",
  Revoked: "badge-revoked",
  OK: "badge-approved",
};

export const statusBadgeClass = (status) => {
  const map = {
    Pending: "bg-amber-50 text-amber-900 border border-amber-200",
    Validated: "bg-cyan-50 text-cyan-900 border border-cyan-200",
    Approved: "bg-green-50 text-green-900 border border-green-200",
    Rejected: "bg-red-50 text-red-900 border border-red-200",
    Present: "bg-green-50 text-green-900 border border-green-200",
    Absent: "bg-red-50 text-red-900 border border-red-200",
    Low: "bg-red-50 text-red-900 border border-red-200",
    Revoke_Pending: "bg-purple-50 text-purple-900 border border-purple-200",
    Revoked: "bg-gray-100 text-gray-700 border border-gray-200",
    OK: "bg-green-50 text-green-900 border border-green-200",
    Claim_Pending: "bg-blue-50 text-blue-900 border border-blue-200",
    Claim_Submitted: "bg-indigo-50 text-indigo-900 border border-indigo-200",
    Claim_Forwarded: "bg-purple-50 text-purple-900 border border-purple-200",
    Claim_Approved: "bg-green-50 text-green-900 border border-green-200",
    // New LP workflow statuses
    LP_PENDING_ADMIN_APPROVAL: "bg-amber-50 text-amber-900 border border-amber-200",
    LP_REJECTED: "bg-red-50 text-red-900 border border-red-200",
    CLAIM_PENDING: "bg-blue-50 text-blue-900 border border-blue-200",
    CLAIM_VALIDATION_PENDING: "bg-amber-50 text-amber-900 border border-amber-200",
    CLAIM_ADMIN_APPROVAL_PENDING: "bg-indigo-50 text-indigo-900 border border-indigo-200",
    CLAIM_APPROVED: "bg-green-50 text-green-900 border border-green-200",
    CLAIM_REJECTED: "bg-red-50 text-red-900 border border-red-200",
  };
  return map[status] || "bg-gray-100 text-gray-700 border border-gray-200";
};
