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
import FormField, { inputClass } from "../../components/common/FormField";
import { formatDate, formatCurrency, genId } from "../../utils/formatters";

const LP_STATUS_LABELS = {
  LP_PENDING_ADMIN_APPROVAL: "Awaiting Admin Approval",
  LP_REJECTED: "LP Rejected",
  CLAIM_PENDING: "LP Approved — Claim Ready",
};

const CLAIM_STATUS_LABELS = {
  CLAIM_VALIDATION_PENDING: "Pending Store Validation",
  CLAIM_ADMIN_APPROVAL_PENDING: "Pending Admin Approval",
  CLAIM_APPROVED: "Claim Approved",
  CLAIM_REJECTED: "Claim Rejected",
};

export default function TLLPRequests() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("lp");
  const [showLpModal, setShowLpModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedLp, setSelectedLp] = useState(null);

  // LP form state
  const [lpForm, setLpForm] = useState({ jobId: "", spareCost: "", serviceCost: "", description: "" });
  // Claim form state
  const [claimForm, setClaimForm] = useState({ claimAmount: "", remarks: "" });

  const { data: lpData, isLoading: lpLoading } = useQuery({
    queryKey: ["tl-lp-requests"],
    queryFn: () => api.get("/lp-requests").then((r) => r.data.data),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: claimData, isLoading: claimLoading } = useQuery({
    queryKey: ["tl-claim-requests"],
    queryFn: () => api.get("/claim-requests").then((r) => r.data.data),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const createLpMutation = useMutation({
    mutationFn: (data) => api.post("/lp-requests", data),
    onSuccess: () => {
      toast.success("LP request submitted for Admin approval");
      qc.invalidateQueries({ queryKey: ["tl-lp-requests"] });
      setShowLpModal(false);
      setLpForm({ jobId: "", spareCost: "", serviceCost: "", description: "" });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Submission failed"),
  });

  const createClaimMutation = useMutation({
    mutationFn: (data) => api.post("/claim-requests", data),
    onSuccess: () => {
      toast.success("Claim request submitted to Store Manager for validation");
      qc.invalidateQueries({ queryKey: ["tl-claim-requests"] });
      qc.invalidateQueries({ queryKey: ["tl-lp-requests"] });
      setShowClaimModal(false);
      setSelectedLp(null);
      setClaimForm({ claimAmount: "", remarks: "" });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Submission failed"),
  });

  const handleLpSubmit = () => {
    const { jobId, spareCost, serviceCost, description } = lpForm;
    if (!jobId.trim()) { toast.error("Job ID is required"); return; }
    if (!description.trim()) { toast.error("Description is required"); return; }
    const spare = parseFloat(spareCost);
    const service = parseFloat(serviceCost);
    if (isNaN(spare) || spare < 0) { toast.error("Enter a valid Spare Cost"); return; }
    if (isNaN(service) || service < 0) { toast.error("Enter a valid Service Cost"); return; }
    createLpMutation.mutate({ jobId: jobId.trim(), spareCost: spare, serviceCost: service, description: description.trim() });
  };

  const handleClaimSubmit = () => {
    const amount = parseFloat(claimForm.claimAmount);
    if (isNaN(amount) || amount < 0) { toast.error("Enter a valid claim amount"); return; }
    if (!claimForm.remarks.trim()) { toast.error("Remarks are required"); return; }
    createClaimMutation.mutate({
      lpRequestId: selectedLp.id,
      claimAmount: amount,
      remarks: claimForm.remarks.trim(),
    });
  };

  const openClaim = (lp) => {
    setSelectedLp(lp);
    setClaimForm({ claimAmount: String(lp.totalCost), remarks: "" });
    setShowClaimModal(true);
  };

  const spareCost = parseFloat(lpForm.spareCost) || 0;
  const serviceCost = parseFloat(lpForm.serviceCost) || 0;
  const totalCost = spareCost + serviceCost;

  if (lpLoading || claimLoading) return <PageSpinner />;

  const lpList = lpData || [];
  const claimList = claimData || [];

  const pendingLpCount = lpList.filter((r) => r.status === "LP_PENDING_ADMIN_APPROVAL").length;
  const claimReadyCount = lpList.filter((r) => r.status === "CLAIM_PENDING" && !r.claim).length;
  const pendingClaimCount = claimList.filter((r) => ["CLAIM_VALIDATION_PENDING", "CLAIM_ADMIN_APPROVAL_PENDING"].includes(r.status)).length;

  const tabs = [
    { key: "lp", label: `LP Requests (${lpList.length})` },
    { key: "claims", label: `My Claims (${claimList.length})` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">LP (Labour & Parts) Requests</h1>
          <p className="text-sm text-muted mt-0.5">Create LP requests, raise claims after Admin approval</p>
        </div>
        {tab === "lp" && (
          <Button onClick={() => setShowLpModal(true)}>
            <i className="ti ti-plus" /> New LP Request
          </Button>
        )}
      </div>

      {/* Summary badges */}
      {(pendingLpCount > 0 || claimReadyCount > 0 || pendingClaimCount > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {pendingLpCount > 0 && (
            <div className="text-xs px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
              <i className="ti ti-clock mr-1" />{pendingLpCount} LP awaiting Admin
            </div>
          )}
          {claimReadyCount > 0 && (
            <div className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
              <i className="ti ti-file-plus mr-1" />{claimReadyCount} LP approved — raise claim now
            </div>
          )}
          {pendingClaimCount > 0 && (
            <div className="text-xs px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900">
              <i className="ti ti-loader mr-1" />{pendingClaimCount} claim in progress
            </div>
          )}
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {/* LP Requests Tab */}
      {tab === "lp" && (
        lpList.length === 0 ? (
          <EmptyState icon="ti-file-invoice" message="No LP requests yet. Create your first one." />
        ) : (
          <div className="space-y-3">
            {lpList.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-muted font-mono">{r.requestId}</span>
                      <span className="font-semibold text-sm">{r.jobId}</span>
                      <Badge status={r.status}>{LP_STATUS_LABELS[r.status] || r.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="text-xs text-muted">Date: {formatDate(r.requestDate)}</div>
                    {r.description && <div className="text-xs text-muted mt-0.5">Description: {r.description}</div>}
                    {r.adminRemarks && (
                      <div className="text-xs text-amber-700 mt-1 italic">
                        <i className="ti ti-message mr-1" />Admin remark: {r.adminRemarks}
                      </div>
                    )}
                    {r.claim && (
                      <div className="text-xs text-indigo-700 mt-1">
                        <i className="ti ti-file-check mr-1" />
                        Claim raised — <Badge status={r.claim.status}>{CLAIM_STATUS_LABELS[r.claim.status] || r.claim.status}</Badge>
                      </div>
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
                      <div className="font-bold text-sm text-accent">{formatCurrency(r.totalCost)}</div>
                    </div>
                  </div>
                </div>

                {r.status === "CLAIM_PENDING" && !r.claim && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <Button size="sm" onClick={() => openClaim(r)}>
                      <i className="ti ti-file-plus" /> Raise Claim Request
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {/* Claims Tab */}
      {tab === "claims" && (
        claimList.length === 0 ? (
          <EmptyState icon="ti-file-check" message="No claims raised yet. Raise a claim for an approved LP request." />
        ) : (
          <div className="space-y-3">
            {claimList.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-muted font-mono">{c.lpRequest?.requestId}</span>
                      <span className="font-semibold text-sm">{c.lpRequest?.jobId}</span>
                      <Badge status={c.status}>{CLAIM_STATUS_LABELS[c.status] || c.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="text-xs text-muted">Raised: {formatDate(c.createdAt)}</div>
                    {c.remarks && <div className="text-xs text-muted mt-0.5">Remarks: {c.remarks}</div>}
                    {c.validationRemarks && (
                      <div className="text-xs text-amber-700 mt-1 italic">
                        <i className="ti ti-building-store mr-1" />Store: {c.validationRemarks}
                      </div>
                    )}
                    {c.approvalRemarks && (
                      <div className="text-xs text-blue-700 mt-1 italic">
                        <i className="ti ti-shield mr-1" />Admin: {c.approvalRemarks}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted">Claim Amount</div>
                    <div className="font-bold text-base text-accent">{formatCurrency(c.claimAmount)}</div>
                  </div>
                </div>

                {/* Progress tracker */}
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {[
                      { key: "CLAIM_VALIDATION_PENDING", label: "Submitted" },
                      { key: "CLAIM_ADMIN_APPROVAL_PENDING", label: "Store Validated" },
                      { key: "CLAIM_APPROVED", label: "Admin Approved" },
                    ].map((step, idx, arr) => {
                      const order = ["CLAIM_VALIDATION_PENDING", "CLAIM_ADMIN_APPROVAL_PENDING", "CLAIM_APPROVED"];
                      const currentIdx = order.indexOf(c.status);
                      const stepIdx = order.indexOf(step.key);
                      const isRejected = c.status === "CLAIM_REJECTED";
                      const isDone = !isRejected && currentIdx >= stepIdx;
                      const isActive = c.status === step.key;
                      return (
                        <div key={step.key} className="flex items-center gap-1">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                            isRejected ? "bg-gray-100 text-gray-400"
                            : isDone ? (isActive ? "bg-accent text-white" : "bg-green-100 text-green-800")
                            : "bg-gray-100 text-gray-400"
                          }`}>
                            {isDone && !isActive && <i className="ti ti-check text-xs" />}
                            {step.label}
                          </div>
                          {idx < arr.length - 1 && <i className="ti ti-chevron-right text-xs text-gray-300" />}
                        </div>
                      );
                    })}
                    {c.status === "CLAIM_REJECTED" && (
                      <div className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                        <i className="ti ti-x text-xs mr-1" />Rejected
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Create LP Modal */}
      <Modal
        open={showLpModal}
        onClose={() => { setShowLpModal(false); setLpForm({ jobId: "", spareCost: "", serviceCost: "", description: "" }); }}
        title="New LP Request"
        width="480px"
      >
        <FormField label="Job ID">
          <div className="flex gap-2">
            <input
              type="text"
              className={inputClass}
              value={lpForm.jobId}
              onChange={(e) => setLpForm({ ...lpForm, jobId: e.target.value })}
              placeholder="e.g. JOB-20260615-A3F"
            />
            <Button type="button" size="sm" onClick={() => setLpForm({ ...lpForm, jobId: genId("JOB") })}>
              Generate
            </Button>
          </div>
        </FormField>
        <FormField label="Description">
          <textarea
            className={inputClass}
            rows={2}
            value={lpForm.description}
            onChange={(e) => setLpForm({ ...lpForm, description: e.target.value })}
            placeholder="Work description, reason for LP request…"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Spare Cost (₹)">
            <input
              type="number"
              className={inputClass}
              min={0}
              step="0.01"
              value={lpForm.spareCost}
              onChange={(e) => setLpForm({ ...lpForm, spareCost: e.target.value })}
              placeholder="0.00"
            />
          </FormField>
          <FormField label="Service Cost (₹)">
            <input
              type="number"
              className={inputClass}
              min={0}
              step="0.01"
              value={lpForm.serviceCost}
              onChange={(e) => setLpForm({ ...lpForm, serviceCost: e.target.value })}
              placeholder="0.00"
            />
          </FormField>
        </div>
        {totalCost > 0 && (
          <div className="mb-4 px-3 py-2 bg-accent2 rounded text-sm flex justify-between">
            <span className="text-accent font-medium">Total Cost</span>
            <span className="font-bold text-accent">{formatCurrency(totalCost)}</span>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <Button onClick={() => { setShowLpModal(false); setLpForm({ jobId: "", spareCost: "", serviceCost: "", description: "" }); }}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleLpSubmit} disabled={createLpMutation.isPending}>
            <i className="ti ti-send" />
            {createLpMutation.isPending ? "Submitting…" : "Submit for Admin Approval"}
          </Button>
        </div>
      </Modal>

      {/* Raise Claim Modal */}
      <Modal
        open={showClaimModal}
        onClose={() => { setShowClaimModal(false); setSelectedLp(null); setClaimForm({ claimAmount: "", remarks: "" }); }}
        title="Raise Claim Request"
        width="460px"
      >
        {selectedLp && (
          <>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted">LP Reference</span>
                <span className="font-mono font-medium">{selectedLp.requestId}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted">Job ID</span>
                <span className="font-medium">{selectedLp.jobId}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-muted font-medium">Approved LP Value</span>
                <span className="font-bold text-accent">{formatCurrency(selectedLp.totalCost)}</span>
              </div>
            </div>
            <FormField label="Claim Amount (₹)">
              <input
                type="number"
                className={inputClass}
                min={0}
                step="0.01"
                value={claimForm.claimAmount}
                onChange={(e) => setClaimForm({ ...claimForm, claimAmount: e.target.value })}
                placeholder="Enter claim amount"
              />
            </FormField>
            <FormField label="Claim Remarks">
              <textarea
                className={inputClass}
                rows={3}
                value={claimForm.remarks}
                onChange={(e) => setClaimForm({ ...claimForm, remarks: e.target.value })}
                placeholder="Describe the claim details, work done, parts used…"
              />
            </FormField>
            <div className="flex justify-end gap-2 mt-2">
              <Button onClick={() => { setShowClaimModal(false); setSelectedLp(null); }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleClaimSubmit} disabled={createClaimMutation.isPending}>
                <i className="ti ti-send" />
                {createClaimMutation.isPending ? "Submitting…" : "Submit Claim"}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
