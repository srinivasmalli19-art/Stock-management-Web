export const statusBadgeClass = (status) => {
  const map = {
    Pending:                       "bg-amber-100 text-amber-800 border border-amber-200",
    Validated:                     "bg-cyan-100 text-cyan-800 border border-cyan-200",
    Approved:                      "bg-emerald-100 text-emerald-800 border border-emerald-200",
    Rejected:                      "bg-red-100 text-red-800 border border-red-200",
    Present:                       "bg-emerald-100 text-emerald-800 border border-emerald-200",
    Absent:                        "bg-red-100 text-red-800 border border-red-200",
    Low:                           "bg-red-100 text-red-800 border border-red-200",
    Revoke_Pending:                "bg-purple-100 text-purple-800 border border-purple-200",
    Revoked:                       "bg-slate-100 text-slate-700 border border-slate-200",
    OK:                            "bg-emerald-100 text-emerald-800 border border-emerald-200",
    Claim_Pending:                 "bg-blue-100 text-blue-800 border border-blue-200",
    Claim_Submitted:               "bg-indigo-100 text-indigo-800 border border-indigo-200",
    Claim_Forwarded:               "bg-purple-100 text-purple-800 border border-purple-200",
    Claim_Approved:                "bg-emerald-100 text-emerald-800 border border-emerald-200",
    LP_PENDING_ADMIN_APPROVAL:     "bg-amber-100 text-amber-800 border border-amber-200",
    LP_REJECTED:                   "bg-red-100 text-red-800 border border-red-200",
    CLAIM_PENDING:                 "bg-blue-100 text-blue-800 border border-blue-200",
    CLAIM_VALIDATION_PENDING:      "bg-amber-100 text-amber-800 border border-amber-200",
    CLAIM_ADMIN_APPROVAL_PENDING:  "bg-indigo-100 text-indigo-800 border border-indigo-200",
    CLAIM_APPROVED:                "bg-emerald-100 text-emerald-800 border border-emerald-200",
    CLAIM_REJECTED:                "bg-red-100 text-red-800 border border-red-200",
  };
  return map[status] || "bg-slate-100 text-slate-700 border border-slate-200";
};
