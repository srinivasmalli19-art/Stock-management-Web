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

const ADVANCE_LABEL = {
  Pending: "Mark Claim Pending",
  Claim_Pending: "Mark Claim Submitted",
  Claim_Submitted: "Forward to Admin",
};

const ACTIONABLE = new Set(["Pending", "Claim_Pending", "Claim_Submitted"]);

export default function StoreLPRequests() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("active");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [actionType, setActionType] = useState(null); // "advance" | "reject"

  const { data, isLoading } = useQuery({
    queryKey: ["lp-requests"],
    queryFn: () => api.get("/lp-requests").then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action, note }) =>
      api.patch(`/lp-requests/${id}/status`, { action, note }),
    onSuccess: (_, { action }) => {
      toast.success(action === "reject" ? "Request rejected" : "Status advanced successfully");
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

  const confirmAction = () => {
    if (!selected) return;
    mutation.mutate({ id: selected.id, action: actionType, note });
  };

  if (isLoading) return <PageSpinner />;

  const all = data || [];
  const active = all.filter((r) => ACTIONABLE.has(r.status));
  const done = all.filter((r) => !ACTIONABLE.has(r.status));

  const tabs = [
    { key: "active", label: `Active (${active.length})` },
    { key: "done", label: `Completed (${done.length})` },
  ];

  const displayList = tab === "active" ? active : done;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">LP Request Queue</h1>
          <p className="text-sm text-muted mt-0.5">Process Labour & Parts claim requests from Team Leaders</p>
        </div>
        {active.length > 0 && <Badge status="Pending">{active.length} pending action</Badge>}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {displayList.length === 0 ? (
        <EmptyState
          icon={tab === "active" ? "ti-check-circle" : "ti-file-off"}
          message={tab === "active" ? "No active LP requests" : "No completed LP requests yet"}
        />
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
                  <div className="text-xs text-muted">TL: {r.tlEmail} · Date: {formatDate(r.date)}</div>
                  {r.note && <div className="text-xs text-muted mt-1 italic">Note: {r.note}</div>}
                </div>
                <div className="flex gap-6 text-right shrink-0">
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
                    <div className="font-semibold text-sm text-accent">{formatCurrency(r.spareCost + r.serviceCost)}</div>
                  </div>
                </div>
              </div>

              {ACTIONABLE.has(r.status) && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Button
                    size="sm"
                    onClick={() => openAction(r, "advance")}
                    disabled={mutation.isPending}
                  >
                    <i className="ti ti-arrow-right" /> {ADVANCE_LABEL[r.status]}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => openAction(r, "reject")}
                    disabled={mutation.isPending}
                  >
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
        title={actionType === "reject" ? "Reject LP Request" : `Advance: ${selected?.jobId}`}
        width="420px"
      >
        {selected && (
          <div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted">Job ID</span>
                <span className="font-medium">{selected.jobId}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted">Total Claim</span>
                <span className="font-semibold text-accent">{formatCurrency(selected.spareCost + selected.serviceCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Current Status</span>
                <Badge status={selected.status} />
              </div>
            </div>

            {actionType === "advance" && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                Status will change to: <strong>{ADVANCE_LABEL[selected.status]?.replace("Mark ", "").replace("Forward to Admin", "Claim Forwarded")}</strong>
              </div>
            )}

            {actionType === "reject" && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
                This request will be marked as Rejected.
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="Add a note for the Team Leader…"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="default" onClick={() => { setSelected(null); setNote(""); setActionType(null); }}>Cancel</Button>
              <Button
                variant={actionType === "reject" ? "danger" : "primary"}
                onClick={confirmAction}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Processing…" : actionType === "reject" ? "Confirm Reject" : "Confirm Advance"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
