import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import FormField, { inputClass } from "../../components/common/FormField";
import SkuTag from "../../components/common/SkuTag";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate } from "../../utils/formatters";

export default function StoreReturnRequests() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [filter, setFilter] = useState("Pending");

  const { data: requestsRes, isLoading } = useQuery({
    queryKey: ["return-requests", "store"],
    queryFn: () => api.get("/return-requests").then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (id) => api.patch(`/return-requests/${id}/approve`),
    onSuccess: (_, id) => {
      toast.success("Return approved — stock returned to warehouse!");
      queryClient.invalidateQueries({ queryKey: ["return-requests"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Approval failed"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) => api.patch(`/return-requests/${id}/reject`, { note }),
    onSuccess: () => {
      toast.success("Return request rejected");
      queryClient.invalidateQueries({ queryKey: ["return-requests"] });
      setRejectTarget(null);
      setRejectNote("");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Rejection failed"),
  });

  if (isLoading) return <PageSpinner />;

  const all = requestsRes || [];
  const displayed = filter === "All" ? all : all.filter((r) => r.status === filter);
  const pendingCount = all.filter((r) => r.status === "Pending").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-5xl font-extrabold text-text tracking-tight">Return Stock Requests</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-warn font-semibold mt-0.5">{pendingCount} pending review</p>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-5 bg-bg rounded-xl p-1 w-fit border border-border">
        {["Pending", "Approved", "Rejected", "All"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              filter === s ? "bg-white text-accent shadow-card font-semibold" : "text-muted hover:text-text"
            }`}
          >
            {s}
            {s !== "All" && (
              <span className="ml-1.5 text-[10px] font-bold">
                ({all.filter((r) => r.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <Card>
        <CardTitle>Return Requests — {filter}</CardTitle>
        {displayed.length === 0 ? (
          <EmptyState icon="ti-arrow-back-up" message={`No ${filter.toLowerCase()} return requests`} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto tbl">
              <table>
                <thead>
                  <tr>
                    <th>Engineer</th>
                    <th>SKU</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Date</th>
                    <th>Note</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.engineer?.name}</strong></td>
                      <td><SkuTag id={r.sku?.code} /></td>
                      <td>{r.sku?.name}</td>
                      <td>{r.qty}</td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td className="text-xs text-muted max-w-[150px] truncate">{r.note || "—"}</td>
                      <td><Badge status={r.status} /></td>
                      <td>
                        {r.status === "Pending" && (
                          <div className="flex gap-1.5">
                            <Button variant="success" size="sm" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>
                              <i className="ti ti-check" /> Approve
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => { setRejectTarget(r); setRejectNote(""); }}>
                              <i className="ti ti-x" /> Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {displayed.map((r) => (
                <div key={r.id} className="border border-border rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">{r.engineer?.name}</div>
                    <Badge status={r.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
                    <div><span className="text-muted text-xs">SKU</span><div><SkuTag id={r.sku?.code} /></div></div>
                    <div><span className="text-muted text-xs">Qty</span><div><strong>{r.qty}</strong></div></div>
                    <div><span className="text-muted text-xs">Item</span><div>{r.sku?.name}</div></div>
                    <div><span className="text-muted text-xs">Date</span><div>{formatDate(r.createdAt)}</div></div>
                  </div>
                  {r.note && <p className="text-xs text-muted mb-2">{r.note}</p>}
                  {r.status === "Pending" && (
                    <div className="flex gap-2 mt-2">
                      <Button variant="success" size="sm" fullWidth onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>
                        <i className="ti ti-check" /> Approve
                      </Button>
                      <Button variant="danger" size="sm" fullWidth onClick={() => { setRejectTarget(r); setRejectNote(""); }}>
                        <i className="ti ti-x" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Reject Modal */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title={`Reject Return Request`}>
        <p className="text-sm text-muted mb-4">
          Rejecting return of <strong>{rejectTarget?.qty}</strong> unit(s) of <strong>{rejectTarget?.sku?.name}</strong> from <strong>{rejectTarget?.engineer?.name}</strong>.
        </p>
        <FormField label="Rejection Reason (optional)">
          <input type="text" className={inputClass} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Optional note to engineer" />
        </FormField>
        <div className="flex gap-2 justify-end mt-4">
          <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => rejectMutation.mutate({ id: rejectTarget.id, note: rejectNote })} disabled={rejectMutation.isPending}>
            <i className="ti ti-x" /> {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
