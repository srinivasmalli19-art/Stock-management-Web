import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Tabs from "../../components/common/Tabs";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, formatCurrency } from "../../utils/formatters";
import { inputClass } from "../../components/common/FormField";

const STATUS_LABELS = {
  CLAIM_VALIDATION_PENDING: "Pending Validation",
  CLAIM_ADMIN_APPROVAL_PENDING: "Validated — Awaiting Admin",
  CLAIM_APPROVED: "Approved",
  CLAIM_REJECTED: "Rejected",
};

export default function StoreLPRequests() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null); // "validate" | "reject"
  const [remarks, setRemarks] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["store-claim-requests"],
    queryFn: () => api.get("/claim-requests").then((r) => r.data.data),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, remarks }) =>
      api.patch(`/claim-requests/${id}/validate`, { action, remarks }),
    onSuccess: (_, { action }) => {
      toast.success(action === "validate" ? "Claim validated and forwarded to Admin" : "Claim rejected");
      qc.invalidateQueries({ queryKey: ["store-claim-requests"] });
      setSelected(null);
      setAction(null);
      setRemarks("");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Action failed"),
  });

  const openModal = (claim, act) => {
    setSelected(claim);
    setAction(act);
    setRemarks("");
  };

  const confirmAction = () => {
    if (!remarks.trim()) { toast.error("Remarks are required"); return; }
    mutation.mutate({ id: selected.id, action, remarks: remarks.trim() });
  };

  if (isLoading) return <PageSpinner />;

  const all = data || [];
  const pending = all.filter((c) => c.status === "CLAIM_VALIDATION_PENDING");
  const done = all.filter((c) => c.status !== "CLAIM_VALIDATION_PENDING");

  const tabs = [
    { key: "pending", label: `Pending Validation (${pending.length})` },
    { key: "done", label: `Processed (${done.length})` },
  ];

  const displayList = tab === "pending" ? pending : done;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">Claim Validation Queue</h1>
          <p className="text-sm text-muted mt-0.5">Validate or reject Team Leader claim requests</p>
        </div>
        {pending.length > 0 && (
          <div className="text-right">
            <div className="text-xs text-muted">Awaiting validation</div>
            <div className="font-bold text-lg text-warn">{pending.length} claim{pending.length !== 1 ? "s" : ""}</div>
          </div>
        )}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {displayList.length === 0 ? (
        <EmptyState
          icon={tab === "pending" ? "ti-check-circle" : "ti-file-off"}
          message={tab === "pending" ? "No claims pending validation" : "No processed claims yet"}
        />
      ) : (
        <div className="space-y-3">
          {displayList.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-muted font-mono">{c.lpRequest?.requestId}</span>
                    <span className="font-semibold text-sm">{c.lpRequest?.jobId}</span>
                    <Badge status={c.status}>{STATUS_LABELS[c.status] || c.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="text-xs text-muted">Team Leader: {c.lpRequest?.tlEmail}</div>
                  <div className="text-xs text-muted">Submitted: {formatDate(c.createdAt)}</div>
                  {c.remarks && (
                    <div className="text-xs text-muted mt-1">
                      <i className="ti ti-message mr-1" />TL Remarks: {c.remarks}
                    </div>
                  )}
                  {c.lpRequest?.description && (
                    <div className="text-xs text-muted mt-0.5">LP Description: {c.lpRequest.description}</div>
                  )}
                  {c.validationRemarks && (
                    <div className="text-xs text-green-700 mt-1 italic">
                      <i className="ti ti-check mr-1" />Your validation: {c.validationRemarks}
                    </div>
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

              {c.status === "CLAIM_VALIDATION_PENDING" && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Button size="sm" variant="success" onClick={() => openModal(c, "validate")} disabled={mutation.isPending}>
                    <i className="ti ti-check" /> Validate & Forward
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => openModal(c, "reject")} disabled={mutation.isPending}>
                    <i className="ti ti-x" /> Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setAction(null); setRemarks(""); }}
        title={action === "validate" ? "Validate Claim" : "Reject Claim"}
        width="440px"
      >
        {selected && (
          <div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
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
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-muted font-medium">Claim Amount</span>
                <span className="font-bold text-accent">{formatCurrency(selected.claimAmount)}</span>
              </div>
            </div>

            {action === "validate" ? (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                <i className="ti ti-check-circle mr-2" />Validating will forward this claim to Admin for final approval.
              </div>
            ) : (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
                <i className="ti ti-alert-circle mr-2" />Rejecting will close this claim. The Team Leader will see your reason.
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
                {action === "reject" ? "Reason for rejection (required)" : "Validation remarks (required)"}
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder={action === "reject" ? "State the reason for rejection…" : "Validation comments for Admin…"}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={() => { setSelected(null); setAction(null); setRemarks(""); }}>Cancel</Button>
              <Button
                variant={action === "reject" ? "danger" : "success"}
                onClick={confirmAction}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Processing…" : action === "reject" ? "Confirm Reject" : "Confirm Validate"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
