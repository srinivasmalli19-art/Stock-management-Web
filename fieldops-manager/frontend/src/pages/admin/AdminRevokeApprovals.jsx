import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Tabs from "../../components/common/Tabs";
import SkuTag from "../../components/common/SkuTag";
import EmptyState from "../../components/common/EmptyState";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate } from "../../utils/formatters";

export default function AdminRevokeApprovals() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["revoke-requests"],
    queryFn: () => api.get("/revoke-requests").then((r) => r.data.data),
  });

  const { data: engStockData } = useQuery({
    queryKey: ["all-engineer-stocks"],
    queryFn: async () => {
      const users = await api.get("/users", { params: { role: "Engineer" } });
      const engineers = users.data.data;
      const stocks = await Promise.all(
        engineers.map((e) => api.get(`/inventory/engineer/${e.id}`).then((r) => ({ engineerId: e.id, stock: r.data.data })))
      );
      return stocks;
    },
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }) =>
      action === "Revoked"
        ? api.patch(`/revoke-requests/${id}/approve`)
        : api.patch(`/revoke-requests/${id}/reject`),
    onSuccess: (_, { action }) => {
      toast.success(action === "Revoked" ? "Revoke approved! Stock returned to warehouse." : "Revoke rejected. Stock allocation remains.");
      queryClient.invalidateQueries({ queryKey: ["revoke-requests"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-main"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Action failed"),
  });

  if (isLoading) return <PageSpinner />;

  const all = data || [];
  const pending = all.filter((r) => r.status === "Revoke_Pending");
  const done = all.filter((r) => r.status !== "Revoke_Pending");

  const getEngQty = (engineerId, skuId) => {
    const eng = (engStockData || []).find((e) => e.engineerId === engineerId);
    return eng?.stock.find((s) => s.skuId === skuId)?.qty ?? 0;
  };

  const tabs = [
    { key: "pending", label: `Pending (${pending.length})` },
    { key: "done", label: `Processed (${done.length})` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Stock Revoke Approvals</h1>
        <Badge status="Revoke_Pending">{pending.length} pending</Badge>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "pending" && (
        <div>
          {pending.length === 0 ? (
            <EmptyState icon="ti-check-circle" message="No revoke requests!" />
          ) : (
            pending.map((rv) => {
              const engQty = getEngQty(rv.engineerId, rv.skuId);
              return (
                <Card key={rv.id} className="mb-3">
                  <div className="flex items-start justify-between mb-2.5">
                    <div>
                      <strong>{rv.engineerName}</strong>{" "}
                      <SkuTag id={rv.id.slice(0, 12)} />
                      <br />
                      <span className="text-xs text-muted">
                        {formatDate(rv.createdAt)} · Req: {rv.reqId?.slice(0, 12)}…
                      </span>
                    </div>
                    <Badge status="Revoke_Pending" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-bg rounded text-xs mb-2.5">
                    <div><div className="text-muted mb-0.5">SKU</div><SkuTag id={rv.skuId} /></div>
                    <div><div className="text-muted mb-0.5">Item</div>{rv.skuName}</div>
                    <div><div className="text-muted mb-0.5">Qty to Revoke</div><strong>{rv.qty}</strong></div>
                  </div>
                  <div className="px-2.5 py-2 bg-purple-50 rounded text-xs text-purple-900 mb-2.5">
                    <i className="ti ti-arrow-back-up text-sm mr-1" />
                    Approving will deduct <strong>{rv.qty} units</strong> from {rv.engineerName}'s van stock (currently {engQty}) and return them to warehouse.
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="danger" size="sm" onClick={() => mutation.mutate({ id: rv.id, action: "Rejected" })} disabled={mutation.isPending}>
                      <i className="ti ti-x" /> Reject
                    </Button>
                    <Button variant="purple" size="sm" onClick={() => mutation.mutate({ id: rv.id, action: "Revoked" })} disabled={mutation.isPending}>
                      <i className="ti ti-check" /> Approve Revoke
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
                <tr><th>ID</th><th>Engineer</th><th>SKU</th><th>Item</th><th>Qty</th><th>Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {done.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState message="No processed revokes" /></td></tr>
                ) : (
                  done.map((rv) => (
                    <tr key={rv.id}>
                      <td className="text-xs text-muted">{rv.id.slice(0, 12)}…</td>
                      <td>{rv.engineerName}</td>
                      <td><SkuTag id={rv.skuId} /></td>
                      <td>{rv.skuName}</td>
                      <td>{rv.qty}</td>
                      <td>{formatDate(rv.createdAt)}</td>
                      <td><Badge status={rv.status} /></td>
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
