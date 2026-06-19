import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Tabs from "../../components/common/Tabs";
import SkuTag from "../../components/common/SkuTag";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, formatCurrency } from "../../utils/formatters";

export default function AdminPurchaseApprovals() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [confirmAction, setConfirmAction] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-purchase"],
    queryFn: () => api.get("/purchase-inward").then((r) => r.data.data),
  });

  const { data: invRes } = useQuery({
    queryKey: ["inventory-main"],
    queryFn: () => api.get("/inventory/main").then((r) => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }) =>
      action === "Approved"
        ? api.patch(`/purchase-inward/${id}/approve`)
        : api.patch(`/purchase-inward/${id}/reject`),
    onSuccess: (_, { action }) => {
      toast.success(action === "Approved" ? "Approved! Stock added to warehouse." : "Purchase entry rejected.");
      queryClient.invalidateQueries({ queryKey: ["admin-purchase"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-main"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Action failed"),
  });

  if (isLoading) return <PageSpinner />;

  const all = data || [];
  const inventory = invRes || [];
  const pending = all.filter((p) => p.status === "Pending");
  const done = all.filter((p) => p.status !== "Pending");

  const getInvQty = (skuId) => inventory.find((i) => i.skuId === skuId)?.qty ?? 0;

  const tabs = [
    { key: "pending", label: `Pending (${pending.length})` },
    { key: "done", label: `Processed (${done.length})` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Purchase Inward Approvals</h1>
        <Badge status="Pending">{pending.length} pending</Badge>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "pending" && (
        <div>
          {pending.length === 0 ? (
            <EmptyState icon="ti-check-circle" message="No pending purchase entries!" />
          ) : (
            pending.map((p) => {
              const curQty = getInvQty(p.skuId);
              return (
                <Card key={p.id} className="mb-3">
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <strong>{p.sku?.name}</strong>{" "}
                      <SkuTag id={p.id.slice(0, 12)} />
                      <br />
                      <span className="text-xs text-muted">
                        {formatDate(p.date)} · Vendor: {p.vendor} · Invoice: {p.invoiceNo}
                      </span>
                    </div>
                    <Badge status="Pending" />
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-2.5 bg-bg rounded text-xs mb-2.5">
                    <div><div className="text-muted mb-0.5">SKU</div><SkuTag id={p.skuId} /></div>
                    <div><div className="text-muted mb-0.5">Qty Received</div><strong>+{p.qty}</strong></div>
                    <div><div className="text-muted mb-0.5">Unit Price</div><strong>{formatCurrency(p.unitPrice)}</strong></div>
                    <div><div className="text-muted mb-0.5">Total Value</div><strong>{formatCurrency(p.qty * p.unitPrice)}</strong></div>
                  </div>
                  <div className="px-2.5 py-2 bg-green-50 rounded text-xs text-green-800 mb-2.5">
                    <i className="ti ti-package-import text-sm mr-1" />
                    Approving will add <strong>+{p.qty} units</strong> of <strong>{p.sku?.name}</strong> to warehouse. Current: {curQty} → {curQty + p.qty}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="danger" size="sm" onClick={() => setConfirmAction({ id: p.id, action: "Rejected", skuName: p.sku?.name, qty: p.qty, vendor: p.vendor })} disabled={mutation.isPending}>
                      <i className="ti ti-x" /> Reject
                    </Button>
                    <Button variant="success" size="sm" onClick={() => setConfirmAction({ id: p.id, action: "Approved", skuName: p.sku?.name, qty: p.qty, vendor: p.vendor })} disabled={mutation.isPending}>
                      <i className="ti ti-check" /> Approve & Add to Warehouse
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.action === "Approved" ? "Approve Purchase Entry?" : "Reject Purchase Entry?"}
        message={confirmAction?.action === "Approved"
          ? `+${confirmAction?.qty} units of ${confirmAction?.skuName} from ${confirmAction?.vendor} will be added to the warehouse.`
          : `Purchase entry from ${confirmAction?.vendor} will be rejected. No stock change.`}
        confirmLabel={confirmAction?.action === "Approved" ? "Approve & Add to Warehouse" : "Reject Entry"}
        variant={confirmAction?.action === "Approved" ? "success" : "danger"}
        loading={mutation.isPending}
        onConfirm={() => {
          mutation.mutate({ id: confirmAction.id, action: confirmAction.action });
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      {tab === "done" && (
        <Card>
          <div className="overflow-x-auto tbl">
            <table>
              <thead>
                <tr><th>ID</th><th>Date</th><th>SKU</th><th>Item</th><th>Qty</th><th>Vendor</th><th>Total Value</th><th>Status</th></tr>
              </thead>
              <tbody>
                {done.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState message="No processed entries" /></td></tr>
                ) : (
                  done.map((p) => (
                    <tr key={p.id}>
                      <td className="text-xs text-muted">{p.id.slice(0, 12)}…</td>
                      <td>{formatDate(p.date)}</td>
                      <td><SkuTag id={p.skuId} /></td>
                      <td>{p.sku?.name}</td>
                      <td>+{p.qty}</td>
                      <td>{p.vendor}</td>
                      <td>{formatCurrency(p.qty * p.unitPrice)}</td>
                      <td><Badge status={p.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
