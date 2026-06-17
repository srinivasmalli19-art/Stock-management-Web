import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Tabs from "../../components/common/Tabs";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, formatCurrency, buildCsvBlob, triggerDownload, todayStr } from "../../utils/formatters";
import { inputClass } from "../../components/common/FormField";

const LP_LABELS = {
  LP_PENDING_ADMIN_APPROVAL: "Pending Approval",
  LP_REJECTED: "Rejected",
  CLAIM_PENDING: "Approved",
};

const CLAIM_LABELS = {
  CLAIM_VALIDATION_PENDING: "Pending Store Validation",
  CLAIM_ADMIN_APPROVAL_PENDING: "Awaiting Final Approval",
  CLAIM_APPROVED: "Approved",
  CLAIM_REJECTED: "Rejected",
};

export default function AdminLPApprovals() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("lp-pending");
  const [selected, setSelected] = useState(null);
  const [modalType, setModalType] = useState(null); // "lp-approve" | "lp-reject" | "claim-approve" | "claim-reject"
  const [remarks, setRemarks] = useState("");

  const { data: lpData, isLoading: lpLoading } = useQuery({
    queryKey: ["admin-lp-requests"],
    queryFn: () => api.get("/lp-requests").then((r) => r.data.data),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: claimData, isLoading: claimLoading } = useQuery({
    queryKey: ["admin-claim-requests"],
    queryFn: () => api.get("/claim-requests").then((r) => r.data.data),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const lpMutation = useMutation({
    mutationFn: ({ id, action, remarks }) =>
      api.patch(`/lp-requests/${id}/review`, { action, remarks }),
    onSuccess: (_, { action }) => {
      toast.success(action === "approve" ? "LP request approved. Team Leader can now raise a claim." : "LP request rejected.");
      qc.invalidateQueries({ queryKey: ["admin-lp-requests"] });
      closeModal();
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Action failed"),
  });

  const claimMutation = useMutation({
    mutationFn: ({ id, action, remarks }) =>
      api.patch(`/claim-requests/${id}/approve`, { action, remarks }),
    onSuccess: (_, { action }) => {
      toast.success(action === "approve" ? "Claim approved!" : "Claim rejected.");
      qc.invalidateQueries({ queryKey: ["admin-claim-requests"] });
      closeModal();
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Action failed"),
  });

  const openModal = (item, type) => {
    setSelected(item);
    setModalType(type);
    setRemarks("");
  };

  const closeModal = () => {
    setSelected(null);
    setModalType(null);
    setRemarks("");
  };

  const confirmAction = () => {
    const isReject = modalType.includes("reject");
    if (modalType.startsWith("lp")) {
      lpMutation.mutate({ id: selected.id, action: isReject ? "reject" : "approve", remarks });
    } else {
      claimMutation.mutate({ id: selected.id, action: isReject ? "reject" : "approve", remarks });
    }
  };

  const handleExport = () => {
    if (tab === "claim-pending" || (tab === "history" && claimList.length > 0)) {
      const all = claimData || [];
      const headers = [
        "LP Reference", "Job ID", "Team Leader", "Claim Amount", "Status",
        "TL Remarks", "Store Validation Remarks", "Admin Remarks", "Submitted Date",
      ];
      const rows = all.map((c) => [
        c.lpRequest?.requestId,
        c.lpRequest?.jobId,
        c.lpRequest?.tlEmail,
        c.claimAmount,
        c.status.replace(/_/g, " "),
        c.remarks || "",
        c.validationRemarks || "",
        c.approvalRemarks || "",
        formatDate(c.createdAt),
      ]);
      triggerDownload(buildCsvBlob(headers, rows), `claims-${todayStr()}.csv`);
    } else {
      const all = lpData || [];
      const headers = [
        "Request ID", "Job ID", "Team Leader", "Date", "Spare", "Service", "Total",
        "Description", "Status", "Admin Remarks",
      ];
      const rows = all.map((r) => [
        r.requestId,
        r.jobId,
        r.tlEmail,
        formatDate(r.requestDate),
        r.spareCost,
        r.serviceCost,
        r.totalCost,
        r.description || "",
        r.status.replace(/_/g, " "),
        r.adminRemarks || "",
      ]);
      triggerDownload(buildCsvBlob(headers, rows), `lp-requests-${todayStr()}.csv`);
    }
  };

  if (lpLoading || claimLoading) return <PageSpinner />;

  const lpList = lpData || [];
  const claimList = claimData || [];

  const lpPending = lpList.filter((r) => r.status === "LP_PENDING_ADMIN_APPROVAL");
  const lpApproved = lpList.filter((r) => r.status === "CLAIM_PENDING");
  const lpRejected = lpList.filter((r) => r.status === "LP_REJECTED");

  const claimsPending = claimList.filter((c) => c.status === "CLAIM_ADMIN_APPROVAL_PENDING");
  const claimsApproved = claimList.filter((c) => c.status === "CLAIM_APPROVED");
  const claimsRejected = claimList.filter((c) => c.status === "CLAIM_REJECTED");
  const claimsInStore = claimList.filter((c) => c.status === "CLAIM_VALIDATION_PENDING");

  const totalApprovedValue = claimsApproved.reduce((s, c) => s + c.claimAmount, 0);

  const tabs = [
    { key: "lp-pending", label: `LP Pending (${lpPending.length})` },
    { key: "claim-pending", label: `Claims Pending (${claimsPending.length})` },
    { key: "history", label: `History` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">LP & Claim Approvals</h1>
          <p className="text-sm text-muted mt-0.5">Approve LP requests and final claim decisions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="default" onClick={handleExport}>
            <i className="ti ti-download" /> CSV
          </Button>
          {(lpPending.length > 0 || claimsPending.length > 0) && (
            <div className="text-right">
              <div className="text-xs text-muted">Total pending action</div>
              <div className="font-bold text-lg text-warn">{lpPending.length + claimsPending.length} item{lpPending.length + claimsPending.length !== 1 ? "s" : ""}</div>
            </div>
          )}
        </div>
      </div>

      {claimsApproved.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 flex items-center justify-between">
          <span><i className="ti ti-check-circle mr-2" />{claimsApproved.length} claim{claimsApproved.length !== 1 ? "s" : ""} approved</span>
          <span className="font-bold">{formatCurrency(totalApprovedValue)} total</span>
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {/* LP Pending Approval */}
      {tab === "lp-pending" && (
        lpPending.length === 0 ? (
          <EmptyState icon="ti-file-check" message="No LP requests pending approval" />
        ) : (
          <div className="space-y-3">
            {lpPending.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-muted">{r.requestId}</span>
                      <span className="font-semibold text-sm">{r.jobId}</span>
                      <Badge status={r.status}>{LP_LABELS[r.status]}</Badge>
                    </div>
                    <div className="text-xs text-muted">Team Leader: {r.tlEmail}</div>
                    <div className="text-xs text-muted">Date: {formatDate(r.requestDate)}</div>
                    {r.description && (
                      <div className="text-xs text-muted mt-1 italic">{r.description}</div>
                    )}
                  </div>
                  <div className="flex gap-5 text-right shrink-0">
                    <div>
                      <div className="text-xs text-muted">Spare</div>
                      <div className="font-semibold text-sm">{formatCurrency(r.spareCost)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Service</div>
                      <div className="font-semibold text-sm">{formatCurrency(r.serviceCost)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Total</div>
                      <div className="font-bold text-base text-accent">{formatCurrency(r.totalCost)}</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Button size="sm" variant="success" onClick={() => openModal(r, "lp-approve")} disabled={lpMutation.isPending}>
                    <i className="ti ti-check" /> Approve LP
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => openModal(r, "lp-reject")} disabled={lpMutation.isPending}>
                    <i className="ti ti-x" /> Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Claims Pending Final Approval */}
      {tab === "claim-pending" && (
        claimsPending.length === 0 ? (
          <EmptyState icon="ti-file-invoice" message="No claims awaiting final approval" />
        ) : (
          <div className="space-y-3">
            {claimsPending.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-muted">{c.lpRequest?.requestId}</span>
                      <span className="font-semibold text-sm">{c.lpRequest?.jobId}</span>
                      <Badge status={c.status}>{CLAIM_LABELS[c.status]}</Badge>
                    </div>
                    <div className="text-xs text-muted">Team Leader: {c.lpRequest?.tlEmail}</div>
                    <div className="text-xs text-muted">Claim raised: {formatDate(c.createdAt)}</div>
                    {c.remarks && (
                      <div className="text-xs text-muted mt-1">TL: {c.remarks}</div>
                    )}
                    {c.validationRemarks && (
                      <div className="text-xs text-green-700 mt-0.5">
                        <i className="ti ti-building-store mr-1" />Store validated: {c.validationRemarks}
                      </div>
                    )}
                    {c.validatedBy && (
                      <div className="text-xs text-muted mt-0.5">Validated by {c.validatedBy} on {formatDate(c.validatedAt)}</div>
                    )}
                  </div>
                  <div className="flex gap-4 text-right shrink-0">
                    <div>
                      <div className="text-xs text-muted">LP Total</div>
                      <div className="font-semibold text-sm">{formatCurrency(c.lpRequest?.totalCost)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">Claim Amount</div>
                      <div className="font-bold text-base text-accent">{formatCurrency(c.claimAmount)}</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Button size="sm" variant="success" onClick={() => openModal(c, "claim-approve")} disabled={claimMutation.isPending}>
                    <i className="ti ti-check" /> Approve Claim
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => openModal(c, "claim-reject")} disabled={claimMutation.isPending}>
                    <i className="ti ti-x" /> Reject
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* History */}
      {tab === "history" && (
        <div className="space-y-4">
          {/* LP history */}
          {(lpApproved.length > 0 || lpRejected.length > 0) && (
            <Card>
              <CardTitle>LP Requests History</CardTitle>
              <div className="space-y-2">
                {[...lpApproved, ...lpRejected].map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted">{r.requestId}</span>
                        <span className="text-sm font-medium">{r.jobId}</span>
                        <Badge status={r.status}>{LP_LABELS[r.status] || r.status}</Badge>
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {r.tlEmail} · {formatDate(r.requestDate)}
                        {r.adminRemarks && <span className="italic ml-2">— {r.adminRemarks}</span>}
                      </div>
                    </div>
                    <div className="font-semibold text-sm text-right">{formatCurrency(r.totalCost)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Claims history */}
          {(claimsApproved.length > 0 || claimsRejected.length > 0 || claimsInStore.length > 0) && (
            <Card>
              <CardTitle>Claims History</CardTitle>
              <div className="space-y-2">
                {[...claimsApproved, ...claimsRejected, ...claimsInStore].map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted">{c.lpRequest?.requestId}</span>
                        <span className="text-sm font-medium">{c.lpRequest?.jobId}</span>
                        <Badge status={c.status}>{CLAIM_LABELS[c.status] || c.status}</Badge>
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {c.lpRequest?.tlEmail} · {formatDate(c.createdAt)}
                        {c.approvalRemarks && <span className="italic ml-2">— {c.approvalRemarks}</span>}
                      </div>
                    </div>
                    <div className="font-semibold text-sm text-right">{formatCurrency(c.claimAmount)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {lpApproved.length === 0 && lpRejected.length === 0 && claimsApproved.length === 0 && claimsRejected.length === 0 && claimsInStore.length === 0 && (
            <EmptyState icon="ti-history" message="No historical records yet" />
          )}
        </div>
      )}

      {/* Shared action modal */}
      <Modal
        open={!!selected}
        onClose={closeModal}
        title={
          modalType === "lp-approve" ? "Approve LP Request" :
          modalType === "lp-reject" ? "Reject LP Request" :
          modalType === "claim-approve" ? "Approve Claim" :
          "Reject Claim"
        }
        width="440px"
      >
        {selected && (
          <div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
              {modalType?.startsWith("lp") ? (
                <>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">Request ID</span>
                    <span className="font-mono font-medium">{selected.requestId}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">Job ID</span>
                    <span className="font-medium">{selected.jobId}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">Team Leader</span>
                    <span>{selected.tlEmail}</span>
                  </div>
                  {selected.description && (
                    <div className="flex justify-between mb-1">
                      <span className="text-muted">Description</span>
                      <span className="text-right max-w-[60%]">{selected.description}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="font-medium text-muted">Total Cost</span>
                    <span className="font-bold text-accent">{formatCurrency(selected.totalCost)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">LP Reference</span>
                    <span className="font-mono font-medium">{selected.lpRequest?.requestId}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">Job ID</span>
                    <span className="font-medium">{selected.lpRequest?.jobId}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">Team Leader</span>
                    <span>{selected.lpRequest?.tlEmail}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">Store Validated By</span>
                    <span>{selected.validatedBy || "—"}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="font-medium text-muted">Claim Amount</span>
                    <span className="font-bold text-accent">{formatCurrency(selected.claimAmount)}</span>
                  </div>
                </>
              )}
            </div>

            {modalType?.includes("reject") ? (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
                <i className="ti ti-alert-circle mr-2" />
                {modalType === "lp-reject" ? "This LP request will be rejected." : "This claim will be rejected."}
              </div>
            ) : (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                <i className="ti ti-check-circle mr-2" />
                {modalType === "lp-approve"
                  ? "Approving will allow the Team Leader to raise a claim request."
                  : "Approving will mark this claim as CLAIM_APPROVED — final decision."}
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
                {modalType?.includes("reject") ? "Reason for rejection" : "Remarks (optional)"}
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder={modalType?.includes("reject") ? "State the reason…" : "Any remarks for the Team Leader…"}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={closeModal}>Cancel</Button>
              <Button
                variant={modalType?.includes("reject") ? "danger" : "success"}
                onClick={confirmAction}
                disabled={lpMutation.isPending || claimMutation.isPending}
              >
                {lpMutation.isPending || claimMutation.isPending ? "Processing…" :
                  modalType === "lp-approve" ? "Approve LP" :
                  modalType === "lp-reject" ? "Reject LP" :
                  modalType === "claim-approve" ? "Approve Claim" : "Reject Claim"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
