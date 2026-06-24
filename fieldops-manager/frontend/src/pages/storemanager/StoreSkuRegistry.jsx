import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import FormField, { inputClass } from "../../components/common/FormField";
import SkuTag from "../../components/common/SkuTag";
import { PageSpinner } from "../../components/common/Spinner";

export default function StoreSkuRegistry() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ id: "", name: "", lowStockAlert: "" });

  const { data: skusRes, isLoading } = useQuery({
    queryKey: ["skus"],
    queryFn: () => api.get("/skus").then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post("/skus", data),
    onSuccess: () => {
      toast.success("SKU registered! Admin has been notified.");
      queryClient.invalidateQueries({ queryKey: ["skus"] });
      setForm({ id: "", name: "", lowStockAlert: "" });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to register SKU"),
  });

  const handleCreate = () => {
    if (!form.id || !form.name) { toast.error("Enter SKU ID and name"); return; }
    createMutation.mutate({ id: form.id, name: form.name, lowStockAlert: parseInt(form.lowStockAlert) || 0 });
  };

  if (isLoading) return <PageSpinner />;
  const skus = skusRes || [];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-5xl font-extrabold text-text tracking-tight">SKU Registry</h1>
        <p className="text-sm text-muted mt-0.5">Register new SKUs. Admin can edit existing entries.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Register New SKU</CardTitle>
          <FormField label="SKU ID" required>
            <input
              type="text"
              className={inputClass}
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })}
              placeholder="e.g. SKU-009"
            />
          </FormField>
          <FormField label="Item Name" required>
            <input
              type="text"
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Product name"
            />
          </FormField>
          <FormField label="Low Stock Alert Qty">
            <input
              type="number"
              className={inputClass}
              min={0}
              value={form.lowStockAlert}
              onChange={(e) => setForm({ ...form, lowStockAlert: e.target.value })}
              placeholder="Alert when qty drops below this"
            />
          </FormField>
          <Button variant="primary" onClick={handleCreate} disabled={createMutation.isPending}>
            <i className="ti ti-plus" />
            {createMutation.isPending ? "Registering..." : "Register SKU"}
          </Button>
        </Card>

        <Card>
          <CardTitle right={`${skus.length} items`}>SKU Catalog</CardTitle>
          <div className="overflow-y-auto max-h-[500px] tbl">
            <table>
              <thead>
                <tr><th>SKU ID</th><th>Name</th><th>Alert Qty</th><th>Warehouse</th><th>Status</th></tr>
              </thead>
              <tbody>
                {skus.map((s) => (
                  <tr key={s.id}>
                    <td><SkuTag id={s.id} /></td>
                    <td>{s.name}</td>
                    <td>{s.lowStockAlert}</td>
                    <td><strong>{s.qty}</strong></td>
                    <td><Badge status={s.isLowStock ? "Low" : "OK"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
