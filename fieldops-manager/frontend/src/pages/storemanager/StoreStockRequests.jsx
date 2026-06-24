import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Tabs from "../../components/common/Tabs";
import SkuTag from "../../components/common/SkuTag";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate } from "../../utils/formatters";

export default function StoreStockRequests() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["stock-requests", "all"],
    queryFn: () => api.get("/stock-requests").then((r) => r.data.data),
  });

  const { data: invRes } = useQuery({
    queryKey: ["inventory-main"],
    queryFn: () => api.get("/inventory/main").then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }) =>
      action === "Approved"
        ? api.patch(`/stock-requests/${id}/approve`)
        : api.patch(`/stock-requests/${id}/reject`),
    onSuccess: (_, { action }) => {
      toast.success(action === "Approved" ? "Request approved! Stock allocated." : "Request rejected.");
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-main"] });
      queryClient.invalidateQueries({ queryKey: ["store-dashboard"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Action failed"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id) => api.post(`/stock-requests/${id}/revoke`),
    onSuccess: () => {
      toast.success("Revoke request submitted to Admin!");
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Revoke failed"),
  });

  if (isLoading) return <PageSpinner />;

  const all = data || [];
  const inventory = invRes || [];
  const pending = all.filter((r) => r.status === "Pending");
  const done = all.filter((r) => r.status !== "Pending");

  const getInvQty = (skuId) => inventory.find((i) => i.skuId === skuId)?.qty ?? 0;

  const tabs = [
    { key: "pending", label: `Pending (${pending.length})` },
    { key: "done", label: `Processed (${done.length})` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Engineer Stock Requests</h1>
        <Badge status="Pending">{pending.length} pending</Badge>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "pending" && (
        <div>
          {pending.length === 0 ? (
            <EmptyState icon="ti-check-circle" message="No pending requests!" />
          ) : (
            pending.map((r) => {
              const avail = getInvQty(r.skuId);
              const insufficient = avail < r.qty;
              return (
                <Card key={r.id} className="mb-3">
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <strong>{r.engineer?.name}</strong>{" "}
                      <SkuTag id={r.id.slice(0, 12)} />
                      <br />
                      <span className="text-xs text-muted">
                        {formatDate(r.createdAt)} · {r.qty} × {r.sku?.name}
                      </span>
                    </div>
                    <Badge status="Pending" />
                  </div>
                  <div className="flex gap-3 text-xs p-2 bg-bg rounded mb-2.5">
                    <span>
                      <strong>Warehouse: </strong>
                      <span className={insufficient ? "text-danger font-semibold" : ""}>{avail} units</span>
                    </span>
                    <span><strong>Requested:</strong> {r.qty}</span>
                  </div>
                  {insufficient && (
                    <Alert variant="danger">
                      Insufficient warehouse stock! Only {avail} available.
                    </Alert>
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button variant="danger" size="sm" onClick={() => mutation.mutate({ id: r.id, action: "Rejected" })} disabled={mutation.isPending}>
                      <i className="ti ti-x" /> Reject
                    </Button>
                    <Button variant="success" size="sm" onClick={() => mutation.mutate({ id: r.id, action: "Approved" })} disabled={mutation.isPending || insufficient}>
                      <i className="ti ti-check" /> Approve
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "done" && (
        <Card>
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr><th>ID</th><th>Engineer</th><th>SKU</th><th>Item</th><th>Qty</th><th>Date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {done.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState message="No processed requests" /></td></tr>
                ) : (
                  done.map((r) => (
                    <tr key={r.id}>
                      <td className="text-xs text-muted">{r.id.slice(0, 12)}…</td>
                      <td>{r.engineer?.name}</td>
                      <td><SkuTag id={r.sku?.code} /></td>
                      <td>{r.sku?.name}</td>
                      <td>{r.qty}</td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td><Badge status={r.status} /></td>
                      <td>
                        {r.status === "Approved" && (
                          <Button variant="warn" size="sm" onClick={() => setConfirmRevoke(r)}>
                            <i className="ti ti-arrow-back-up" /> Revoke
                          </Button>
                        )}
                        {r.status === "Revoke_Pending" && (
                          <span className="text-xs text-muted italic">Revoke pending</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <ConfirmDialog
        open={!!confirmRevoke}
        title="Initiate Stock Revoke?"
        message={`Return ${confirmRevoke?.qty} × ${confirmRevoke?.sku?.name} from ${confirmRevoke?.engineer?.name} to the warehouse.`}
        detail="Admin will need to approve this revoke before stock is transferred."
        confirmLabel="Submit Revoke"
        variant="warn"
        loading={revokeMutation.isPending}
        onConfirm={() => {
          revokeMutation.mutate(confirmRevoke.id);
          setConfirmRevoke(null);
        }}
        onCancel={() => setConfirmRevoke(null)}
      />
    </div>
  );
}
