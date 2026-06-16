import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2 } from "lucide-react";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import { PageSpinner } from "../../components/common/Spinner";
import Badge from "../../components/common/Badge";
import { formatDate } from "../../utils/formatters";

const EMPTY = { name: "", siteCode: "" };

export default function SuperAdminOrgs() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sa-organisations"],
    queryFn: () => api.get("/organisations").then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: (body) => api.post("/organisations", body),
    onSuccess: () => { qc.invalidateQueries(["sa-organisations"]); setForm(EMPTY); setShowForm(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/organisations/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(["sa-organisations"]); setEditId(null); },
  });

  if (isLoading) return <PageSpinner />;
  const orgs = data || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    createMut.mutate(form);
  };

  const toggleStatus = (org) => {
    updateMut.mutate({ id: org.id, body: { isActive: !org.isActive } });
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 size={20} />
            Organisation Management
          </h1>
          <p className="text-sm text-muted mt-0.5">{orgs.length} organisation{orgs.length !== 1 ? "s" : ""} registered</p>
        </div>
        <button className="btn btn-primary flex items-center gap-1.5" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> New Org
        </button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <CardTitle>Register New Organisation</CardTitle>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div>
              <label className="label">Organisation Name</label>
              <input
                className="input"
                placeholder="e.g. Logitask Mumbai"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Site Code</label>
              <input
                className="input font-mono"
                placeholder="e.g. MUM-001"
                value={form.siteCode}
                onChange={(e) => setForm({ ...form, siteCode: e.target.value.toUpperCase() })}
                pattern="[A-Z0-9\-]+"
                maxLength={20}
                required
              />
              <p className="text-xs text-muted mt-0.5">Alphanumeric, unique identifier for this site</p>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create Organisation"}
              </button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
            {createMut.isError && (
              <p className="sm:col-span-2 text-sm text-danger">{createMut.error?.response?.data?.message || "Failed to create"}</p>
            )}
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>All Organisations</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Site Code</th>
                <th>Users</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id}>
                  <td className="font-medium">{org.name}</td>
                  <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{org.siteCode}</span></td>
                  <td>{org._count?.users ?? 0}</td>
                  <td><Badge status={org.isActive ? "Active" : "Inactive"} /></td>
                  <td>{formatDate(org.createdAt)}</td>
                  <td>
                    <button
                      className={`text-xs font-medium ${org.isActive ? "text-danger" : "text-success"}`}
                      onClick={() => toggleStatus(org)}
                      disabled={updateMut.isPending}
                    >
                      {org.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-4">No organisations yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
