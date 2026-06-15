import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import FormField, { selectClass, inputClass } from "../../components/common/FormField";
import SkuTag from "../../components/common/SkuTag";
import EmptyState from "../../components/common/EmptyState";
import { formatDate, buildCsvBlob, triggerDownload, todayStr } from "../../utils/formatters";

export default function EngVanStock() {
  const queryClient = useQueryClient();
  const [reqSkuId, setReqSkuId] = useState("");
  const [reqQty, setReqQty] = useState("");

  const { data: stockRes, isLoading: stockLoading } = useQuery({
    queryKey: ["my-stock"],
    queryFn: () => api.get("/inventory/my-stock").then((r) => r.data.data),
  });

  const { data: skusRes } = useQuery({
    queryKey: ["skus"],
    queryFn: () => api.get("/skus").then((r) => r.data.data),
  });

  const { data: requestsRes } = useQuery({
    queryKey: ["stock-requests", "mine"],
    queryFn: () => api.get("/stock-requests").then((r) => r.data.data),
  });

  const stock = stockRes || [];
  const skus = skusRes || [];
  const requests = requestsRes || [];

  const mutation = useMutation({
    mutationFn: (data) => api.post("/stock-requests", data),
    onSuccess: () => {
      toast.success("Stock request submitted to Store Manager!");
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
      setReqQty("");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to submit request"),
  });

  const handleRequest = () => {
    const qty = parseInt(reqQty);
    if (!reqSkuId) { toast.error("Select a SKU"); return; }
    if (!qty || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    mutation.mutate({ skuId: reqSkuId, qty });
  };

  if (!reqSkuId && skus.length > 0) setReqSkuId(skus[0].id);

  const statusMap = (s) => {
    if (s === "Revoke_Pending") return "Revoke_Pending";
    return s;
  };

  const handleExport = () => {
    const headers = ["SKU ID", "Item Name", "Quantity"];
    const rows = stock.map((s) => [s.skuId, s.sku?.name, s.qty]);
    triggerDownload(buildCsvBlob(headers, rows), `van-stock-${todayStr()}.csv`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">My Van Stock</h1>
        {stock.length > 0 && (
          <Button size="sm" variant="default" onClick={handleExport}>
            <i className="ti ti-download" /> Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardTitle>Current Van Inventory</CardTitle>
          {stock.length === 0 ? (
            <EmptyState icon="ti-package-off" message="No stock allocated to your van" />
          ) : (
            <div className="overflow-x-auto tbl">
              <table>
                <thead><tr><th>SKU</th><th>Item</th><th>Qty</th></tr></thead>
                <tbody>
                  {stock.map((s) => (
                    <tr key={s.id}>
                      <td><SkuTag id={s.skuId} /></td>
                      <td>{s.sku?.name}</td>
                      <td><strong>{s.qty}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Request New Stock</CardTitle>
          <FormField label="SKU Item">
            <select className={selectClass} value={reqSkuId} onChange={(e) => setReqSkuId(e.target.value)}>
              {skus.map((s) => (
                <option key={s.id} value={s.id}>{s.id} – {s.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Quantity Needed">
            <input
              type="number"
              className={inputClass}
              min={1}
              value={reqQty}
              onChange={(e) => setReqQty(e.target.value)}
              placeholder="Enter quantity"
            />
          </FormField>
          <Button variant="primary" onClick={handleRequest} disabled={mutation.isPending}>
            <i className="ti ti-send" />
            {mutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </Card>
      </div>

      <Card>
        <CardTitle>Stock Request History</CardTitle>
        {requests.length === 0 ? (
          <EmptyState icon="ti-inbox" message="No requests yet" />
        ) : (
          <div className="overflow-x-auto tbl">
            <table>
              <thead><tr><th>Req ID</th><th>SKU</th><th>Item</th><th>Qty</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs text-muted">{r.id.slice(0, 12)}…</td>
                    <td><SkuTag id={r.skuId} /></td>
                    <td>{r.sku?.name}</td>
                    <td>{r.qty}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td><Badge status={statusMap(r.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
