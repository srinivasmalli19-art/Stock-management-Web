import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import FormField, { inputClass, selectClass } from "../../components/common/FormField";
import SkuTag from "../../components/common/SkuTag";
import { PageSpinner } from "../../components/common/Spinner";
import { formatDate, formatCurrency } from "../../utils/formatters";

export default function StorePurchaseInward() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    skuId: "", qty: "", unitPrice: "", vendor: "", invoiceNo: "", date: today,
  });

  const { data: skusRes } = useQuery({
    queryKey: ["skus"],
    queryFn: () => api.get("/skus").then((r) => r.data.data),
  });

  const { data: inwardsRes, isLoading } = useQuery({
    queryKey: ["purchase-inward"],
    queryFn: () => api.get("/purchase-inward").then((r) => r.data.data),
  });

  const { data: invRes } = useQuery({
    queryKey: ["inventory-main"],
    queryFn: () => api.get("/inventory/main").then((r) => r.data.data),
  });

  const skus = skusRes || [];
  const inwards = inwardsRes || [];
  const inventory = invRes || [];

  const mutation = useMutation({
    mutationFn: (data) => api.post("/purchase-inward", data),
    onSuccess: () => {
      toast.success("Purchase entry submitted for Admin approval!");
      queryClient.invalidateQueries({ queryKey: ["purchase-inward"] });
      queryClient.invalidateQueries({ queryKey: ["store-dashboard"] });
      setForm({ skuId: skus[0]?.id || "", qty: "", unitPrice: "", vendor: "", invoiceNo: "", date: today });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Submission failed"),
  });

  const handleSubmit = () => {
    if (!form.skuId) { toast.error("Select a SKU"); return; }
    if (!parseInt(form.qty) || parseInt(form.qty) <= 0) { toast.error("Enter a valid quantity"); return; }
    if (!form.vendor.trim()) { toast.error("Enter vendor name"); return; }
    mutation.mutate({
      skuId: form.skuId,
      qty: parseInt(form.qty),
      unitPrice: parseFloat(form.unitPrice) || 0,
      vendor: form.vendor,
      invoiceNo: form.invoiceNo || "N/A",
      date: form.date,
    });
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  if (!form.skuId && skus.length > 0) update("skuId", skus[0].id);

  if (isLoading) return <PageSpinner />;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Purchase Inward</h1>
        <p className="text-sm text-muted mt-0.5">Record new stock — sent to Admin for approval before updating warehouse</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>New Purchase Entry</CardTitle>
          <Alert variant="warn">
            Entries submitted here will be <strong>pending Admin approval</strong> before they update warehouse stock.
          </Alert>
          <FormField label="SKU Item">
            <select className={selectClass} value={form.skuId} onChange={(e) => update("skuId", e.target.value)}>
              {skus.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantity">
              <input type="number" className={inputClass} min={1} value={form.qty} onChange={(e) => update("qty", e.target.value)} placeholder="0" />
            </FormField>
            <FormField label="Unit Price (₹)">
              <input type="number" className={inputClass} min={0} value={form.unitPrice} onChange={(e) => update("unitPrice", e.target.value)} placeholder="0" />
            </FormField>
          </div>
          <FormField label="Vendor Name">
            <input type="text" className={inputClass} value={form.vendor} onChange={(e) => update("vendor", e.target.value)} placeholder="Supplier / Vendor name" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Invoice No.">
              <input type="text" className={inputClass} value={form.invoiceNo} onChange={(e) => update("invoiceNo", e.target.value)} placeholder="INV-XXXX" />
            </FormField>
            <FormField label="Date">
              <input type="date" className={inputClass} value={form.date} onChange={(e) => update("date", e.target.value)} />
            </FormField>
          </div>
          <Button variant="primary" onClick={handleSubmit} disabled={mutation.isPending}>
            <i className="ti ti-send" />
            {mutation.isPending ? "Submitting..." : "Submit for Admin Approval"}
          </Button>
        </Card>

        <Card>
          <CardTitle right="Live (Approved stock only)">Current Main Inventory</CardTitle>
          <div className="overflow-y-auto max-h-[400px] tbl">
            <table>
              <thead><tr><th>SKU</th><th>Item</th><th>Qty</th></tr></thead>
              <tbody>
                {inventory.map((i) => (
                  <tr key={i.skuId}>
                    <td><SkuTag id={i.skuCode} /></td>
                    <td>{i.skuName}</td>
                    <td>
                      {i.isLowStock
                        ? <strong className="text-danger">{i.qty} ⚠</strong>
                        : <strong>{i.qty}</strong>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>All Inward Entries</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr><th>ID</th><th>Date</th><th>SKU</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Vendor</th><th>Invoice</th><th>Status</th></tr>
            </thead>
            <tbody>
              {[...inwards].reverse().map((p) => (
                <tr key={p.id}>
                  <td className="text-xs text-muted">{p.id.slice(0, 12)}…</td>
                  <td>{formatDate(p.date)}</td>
                  <td><SkuTag id={p.sku?.code} /></td>
                  <td>{p.sku?.name}</td>
                  <td>+{p.qty}</td>
                  <td>{formatCurrency(p.unitPrice)}</td>
                  <td>{p.vendor}</td>
                  <td>{p.invoiceNo || "—"}</td>
                  <td><Badge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
