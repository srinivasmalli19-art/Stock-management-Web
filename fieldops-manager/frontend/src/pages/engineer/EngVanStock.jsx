import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import FormField, { selectClass, inputClass } from "../../components/common/FormField";
import SkuTag from "../../components/common/SkuTag";
import EmptyState from "../../components/common/EmptyState";
import { formatDate, buildCsvBlob, triggerDownload, todayStr } from "../../utils/formatters";

export default function EngVanStock() {
  const queryClient = useQueryClient();

  // Request new stock
  const [reqSkuId, setReqSkuId] = useState("");
  const [reqQty, setReqQty] = useState("");

  // Return stock modal
  const [returnOpen, setReturnOpen] = useState(false);
  const [retSkuId, setRetSkuId] = useState("");
  const [retQty, setRetQty] = useState("");
  const [retNote, setRetNote] = useState("");

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

  const { data: returnRequestsRes } = useQuery({
    queryKey: ["return-requests", "mine"],
    queryFn: () => api.get("/return-requests").then((r) => r.data.data),
  });

  const stock = stockRes || [];
  const skus = skusRes || [];
  const requests = requestsRes || [];
  const returnRequests = returnRequestsRes || [];

  // Only SKUs currently in van for return
  const vanSkus = stock.filter((s) => s.qty > 0);

  const requestMutation = useMutation({
    mutationFn: (data) => api.post("/stock-requests", data),
    onSuccess: () => {
      toast.success("Stock request submitted to Store Manager!");
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
      setReqQty("");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to submit request"),
  });

  const returnMutation = useMutation({
    mutationFn: (data) => api.post("/return-requests", data),
    onSuccess: () => {
      toast.success("Return request submitted to Store Manager!");
      queryClient.invalidateQueries({ queryKey: ["return-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-stock"] });
      setReturnOpen(false);
      setRetSkuId("");
      setRetQty("");
      setRetNote("");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to submit return request"),
  });

  const resubmitStockMutation = useMutation({
    mutationFn: (id) => api.patch(`/stock-requests/${id}/resubmit`),
    onSuccess: () => {
      toast.success("Stock request resubmitted!");
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Resubmit failed"),
  });

  const resubmitReturnMutation = useMutation({
    mutationFn: (id) => api.patch(`/return-requests/${id}/resubmit`),
    onSuccess: () => {
      toast.success("Return request resubmitted!");
      queryClient.invalidateQueries({ queryKey: ["return-requests"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Resubmit failed"),
  });

  const handleRequest = () => {
    const qty = parseInt(reqQty);
    if (!reqSkuId) { toast.error("Select a SKU"); return; }
    if (!qty || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    requestMutation.mutate({ skuId: reqSkuId, qty });
  };

  const handleReturn = () => {
    const qty = parseInt(retQty);
    if (!retSkuId) { toast.error("Select a SKU to return"); return; }
    if (!qty || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    returnMutation.mutate({ skuId: retSkuId, qty, note: retNote });
  };

  const openReturn = () => {
    setRetSkuId(vanSkus[0]?.skuId || "");
    setRetQty("");
    setRetNote("");
    setReturnOpen(true);
  };

  if (!reqSkuId && skus.length > 0) setReqSkuId(skus[0].id);

  const handleExport = () => {
    const headers = ["SKU ID", "Item Name", "Quantity"];
    const rows = stock.map((s) => [s.skuId, s.sku?.name, s.qty]);
    triggerDownload(buildCsvBlob(headers, rows), `van-stock-${todayStr()}.csv`);
  };

  const selectedVanItem = vanSkus.find((s) => s.skuId === retSkuId);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-5xl font-extrabold text-text tracking-tight">My Van Stock</h1>
        <div className="flex items-center gap-2">
          {vanSkus.length > 0 && (
            <Button size="sm" variant="warn" onClick={openReturn}>
              <i className="ti ti-arrow-back-up" /> Return Stock
            </Button>
          )}
          {stock.length > 0 && (
            <Button size="sm" variant="default" onClick={handleExport}>
              <i className="ti ti-download" /> Export CSV
            </Button>
          )}
        </div>
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
                      <td><SkuTag id={s.sku?.code} /></td>
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
                <option key={s.id} value={s.id}>{s.code} – {s.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Quantity Needed">
            <input type="number" className={inputClass} min={1} value={reqQty} onChange={(e) => setReqQty(e.target.value)} placeholder="Enter quantity" />
          </FormField>
          <Button variant="primary" onClick={handleRequest} disabled={requestMutation.isPending}>
            <i className="ti ti-send" />
            {requestMutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </Card>
      </div>

      {/* Stock Request History */}
      <Card className="mb-5">
        <CardTitle>Stock Request History</CardTitle>
        {requests.length === 0 ? (
          <EmptyState icon="ti-inbox" message="No requests yet" />
        ) : (
          <div className="overflow-x-auto tbl">
            <table>
              <thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Date</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td><SkuTag id={r.sku?.code} /></td>
                    <td>{r.sku?.name}</td>
                    <td>{r.qty}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td><Badge status={r.status} /></td>
                    <td>
                      {r.status === "Rejected" && (
                        <Button variant="warn" size="sm" onClick={() => resubmitStockMutation.mutate(r.id)} disabled={resubmitStockMutation.isPending}>
                          <i className="ti ti-refresh" /> Resubmit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Return Request History */}
      <Card>
        <CardTitle>Return Request History</CardTitle>
        {returnRequests.length === 0 ? (
          <EmptyState icon="ti-arrow-back-up" message="No return requests yet" sub="Use the Return Stock button to return items to the warehouse." />
        ) : (
          <div className="overflow-x-auto tbl">
            <table>
              <thead><tr><th>SKU</th><th>Item</th><th>Qty</th><th>Date</th><th>Status</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {returnRequests.map((r) => (
                  <tr key={r.id}>
                    <td><SkuTag id={r.sku?.code} /></td>
                    <td>{r.sku?.name}</td>
                    <td>{r.qty}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td><Badge status={r.status} /></td>
                    <td className="text-xs text-muted">{r.note || "—"}</td>
                    <td>
                      {r.status === "Rejected" && (
                        <Button variant="warn" size="sm" onClick={() => resubmitReturnMutation.mutate(r.id)} disabled={resubmitReturnMutation.isPending}>
                          <i className="ti ti-refresh" /> Resubmit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Return Stock Modal */}
      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Return Stock to Warehouse">
        <FormField label="SKU to Return" required>
          <select className={selectClass} value={retSkuId} onChange={(e) => setRetSkuId(e.target.value)}>
            {vanSkus.map((s) => (
              <option key={s.skuId} value={s.skuId}>{s.skuId} – {s.sku?.name} (van: {s.qty})</option>
            ))}
          </select>
        </FormField>
        {selectedVanItem && (
          <p className="text-xs text-muted mb-3">Available in van: <strong>{selectedVanItem.qty}</strong> unit(s)</p>
        )}
        <FormField label="Quantity to Return" required>
          <input
            type="number"
            className={inputClass}
            min={1}
            max={selectedVanItem?.qty || undefined}
            value={retQty}
            onChange={(e) => setRetQty(e.target.value)}
            placeholder="Enter quantity"
          />
        </FormField>
        <FormField label="Note (optional)">
          <input type="text" className={inputClass} value={retNote} onChange={(e) => setRetNote(e.target.value)} placeholder="Reason for return, condition, etc." />
        </FormField>
        <div className="flex gap-2 justify-end mt-4">
          <Button onClick={() => setReturnOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleReturn} disabled={returnMutation.isPending}>
            <i className="ti ti-arrow-back-up" />
            {returnMutation.isPending ? "Submitting..." : "Submit Return"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
