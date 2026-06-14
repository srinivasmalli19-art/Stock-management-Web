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

export default function AdminLPApprovals() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("forwarded");
  const [selected, setSelected] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["lp-requests"],
    queryFn: () => api.get("/lp-requests").then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, note }) =>
      api.patch(`/lp-requests/${id}/status`, { action, note }),
    onSuccess: (_, { action }) => {
      toast.success(action === "reject" ? "LP request rejected" : "LP request approved!");
      qc.invalidateQueries({ queryKey: ["lp-requests"] });
      setSelected(null);
      setNote("");
      setActionType(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Action failed"),
  });

  const openAction = (req, type) => {
    setSelected(req);
    setActionType(type);
    setNote("");
  };

  if (isLoading) return <PageSpinner />;

  const all = data || [];
  const forwarded = all.filter((r) => r.status === "Claim_Forwarded");
  const approved = all.filter((r) => r.status === "Claim_Approved");
  const rejected = all.filter((r) => r.status === "Rejected");
  const other = all.filter((r) => !["Claim_Forwarded", "Claim_Approved", "Rejected"].includes(r.status));

  const tabs = [
    { key: "forwarded", label: `Awaiting Approval (${forwarded.length})` },
    { key: "approved", label: `Approved (${approved.length})` },
    { key: "rejected", label: `Rejected (${rejected.length})` },
    { key: "other", label: `In Progress (${other.length})` },
  ];

  const displayMap = { forwarded, approved, rejected, other };
  const displayList = displayMap[tab] || [];

  const totalApprovedValue = approved.reduce((sum, r) => sum + r.spareCost + r.serviceCost, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">LP Claim Approvals</h1>
          <p className="text-sm text-muted mt-0.5">Final approval for Labour & Parts claim requests</p>
        </div>
        {forwarded.length > 0 && (
          <div className="text-right">
            <div className="text-xs text-muted">Pending Approval</div>
            <div className="font-bold text-lg text-warn">{forwarded.length} request{forwarded.length > 1 ? "s" : ""}</div>
          </div>
        )}
      </div>

      {approved.length > 0 && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 flex items-center justify-between">
          <span><i className="ti ti-check-circle mr-2" />Total claims approved this period</span>
          <span className="font-bold">{formatCurrency(totalApprovedValue)}</span>
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {displayList.length === 0 ? (
        <EmptyState icon="ti-file-check" message={`No ${tab} LP requests`} />
      ) : (
        <div className="space-y-3">
          {displayList.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm">{r.jobId}</span>
                    <Badge status={r.status} />
                  </div>
                  <div className="text-xs text-muted">Team Leader: {r.tlEmail}</div>
                  <div className="text-xs text-muted">Date: {formatDate(r.date)}</div>
                  {r.note && <div className="text-xs text-muted mt-1 italic">Note: {r.note}</div>}
                </div>
                <div className="flex gap-6 text-right shrink-0">
                  <div>
                    <div className="text-xs text-muted">Spare Cost</div>
                    <div className="font-semibold text-sm">{formatCurrency(r.spareCost)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Service Cost</div>
                    <div className="font-semibold text-sm">{formatCurrency(r.serviceCost)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Total Claim</div>
                    <div className="font-bold text-base text-accent">{formatCurrency(r.spareCost + r.serviceCost)}</div>
                  </div>
                </div>
              </div>

              {r.status === "Claim_Forwarded" && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Button size="sm" variant="success" onClick={() => openAction(r, "advance")} disabled={mutation.isPending}>
                    <i className="ti ti-check" /> Approve Claim
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => openAction(r, "reject")} disabled={mutation.isPending}>
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
        onClose={() => { setSelected(null); setNote(""); setActionType(null); }}
        title={actionType === "reject" ? "Reject LP Claim" : "Approve LP Claim"}
        width="420px"
      >
        {selected && (
          <div>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted">Job ID</span>
                <span className="text-sm font-semibold">{selected.jobId}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted">Team Leader</span>
                <span className="text-sm">{selected.tlEmail}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted">Spare Cost</span>
                <span className="text-sm font-medium">{formatCurrency(selected.spareCost)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted">Service Cost</span>
                <span className="text-sm font-medium">{formatCurrency(selected.serviceCost)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-sm font-semibold">Total Claim</span>
                <span className="font-bold text-accent">{formatCurrency(selected.spareCost + selected.serviceCost)}</span>
              </div>
            </div>

            {actionType === "advance" ? (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                <i className="ti ti-check-circle mr-2" />This will mark the claim as <strong>Approved</strong>.
              </div>
            ) : (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
                <i className="ti ti-alert-circle mr-2" />This will mark the claim as <strong>Rejected</strong>.
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">
                {actionType === "reject" ? "Reason for rejection" : "Approval note (optional)"}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder={actionType === "reject" ? "Provide a reason…" : "Any remarks…"}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="default" onClick={() => { setSelected(null); setNote(""); setActionType(null); }}>
                Cancel
              </Button>
              <Button
                variant={actionType === "reject" ? "danger" : "success"}
                onClick={() => mutation.mutate({ id: selected.id, action: actionType, note })}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Processing…" : actionType === "reject" ? "Confirm Reject" : "Confirm Approve"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
