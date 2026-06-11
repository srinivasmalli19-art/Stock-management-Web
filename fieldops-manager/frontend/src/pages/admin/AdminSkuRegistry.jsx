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
import { PageSpinner } from "../../components/common/Spinner";

export default function AdminSkuRegistry() {
  const queryClient = useQueryClient();
  const [editSku, setEditSku] = useState(null);
  const [form, setForm] = useState({ id: "", name: "", lowStockAlert: "" });
  const [editForm, setEditForm] = useState({ name: "", lowStockAlert: "" });

  const { data: skusRes, isLoading } = useQuery({
    queryKey: ["skus"],
    queryFn: () => api.get("/skus").then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post("/skus", data),
    onSuccess: () => {
      toast.success(`SKU registered!`);
      queryClient.invalidateQueries({ queryKey: ["skus"] });
      setForm({ id: "", name: "", lowStockAlert: "" });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to register SKU"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/skus/${id}`, data),
    onSuccess: () => {
      toast.success("SKU updated!");
      queryClient.invalidateQueries({ queryKey: ["skus"] });
      setEditSku(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Update failed"),
  });

  const handleCreate = () => {
    if (!form.id || !form.name) { toast.error("Enter SKU ID and name"); return; }
    createMutation.mutate({ id: form.id, name: form.name, lowStockAlert: parseInt(form.lowStockAlert) || 0 });
  };

  const openEdit = (sku) => {
    setEditSku(sku);
    setEditForm({ name: sku.name, lowStockAlert: sku.lowStockAlert });
  };

  const handleSave = () => {
    if (!editForm.name) { toast.error("Name cannot be empty"); return; }
    updateMutation.mutate({ id: editSku.id, data: { name: editForm.name, lowStockAlert: parseInt(editForm.lowStockAlert) || 0 } });
  };

  if (isLoading) return <PageSpinner />;
  const skus = skusRes || [];

  return (
    <div>
      <div className="mb-5"><h1 className="text-xl font-bold">SKU Registry</h1></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Register New SKU</CardTitle>
          <FormField label="SKU ID">
            <input type="text" className={inputClass} value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.toUpperCase() })} placeholder="e.g. SKU-009" />
          </FormField>
          <FormField label="Item Name">
            <input type="text" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" />
          </FormField>
          <FormField label="Low Stock Alert Qty">
            <input type="number" className={inputClass} min={0} value={form.lowStockAlert} onChange={(e) => setForm({ ...form, lowStockAlert: e.target.value })} placeholder="Alert when qty drops below this" />
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
                <tr><th>SKU ID</th><th>Name</th><th>Alert Qty</th><th>Warehouse</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {skus.map((s) => (
                  <tr key={s.id}>
                    <td><SkuTag id={s.id} /></td>
                    <td>{s.name}</td>
                    <td>{s.lowStockAlert}</td>
                    <td><strong>{s.qty}</strong></td>
                    <td><Badge status={s.isLowStock ? "Low" : "OK"} /></td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                        <i className="ti ti-edit" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={!!editSku} onClose={() => setEditSku(null)} title={`Modify SKU — ${editSku?.id}`}>
        <FormField label="SKU ID">
          <input className={inputClass} value={editSku?.id || ""} disabled style={{ opacity: 0.6 }} />
        </FormField>
        <FormField label="Item Name">
          <input type="text" className={inputClass} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
        </FormField>
        <FormField label="Low Stock Alert Qty">
          <input type="number" className={inputClass} min={0} value={editForm.lowStockAlert} onChange={(e) => setEditForm({ ...editForm, lowStockAlert: e.target.value })} />
        </FormField>
        <div className="flex gap-2 justify-end mt-2">
          <Button onClick={() => setEditSku(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={updateMutation.isPending}>
            <i className="ti ti-device-floppy" /> Save Changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}
