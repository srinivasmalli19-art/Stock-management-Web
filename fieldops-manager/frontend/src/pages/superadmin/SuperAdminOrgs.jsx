import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { PageSpinner } from "../../components/common/Spinner";
import Badge from "../../components/common/Badge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { formatDate, genPassword } from "../../utils/formatters";

const EMPTY = { name: "", siteCode: "", adminName: "", adminEmail: "", password: "" };

export default function SuperAdminOrgs() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [confirmOrg, setConfirmOrg] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sa-organisations"],
    queryFn: () => api.get("/organisations").then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: (body) => api.post("/organisations", body),
    onSuccess: () => {
      toast.success("Organisation and Admin created successfully");
      qc.invalidateQueries(["sa-organisations"]);
      setForm(EMPTY);
      setShowForm(false);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to create organisation"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/organisations/${id}`, body),
    onSuccess: () => qc.invalidateQueries(["sa-organisations"]),
  });

  if (isLoading) return <PageSpinner />;
  const orgs = data || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    createMut.mutate(form);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-2">
            <i className="ti ti-building text-accent text-2xl" />
            Organisation Management
          </h1>
          <p className="text-sm text-muted mt-0.5">{orgs.length} organisation{orgs.length !== 1 ? "s" : ""} registered</p>
        </div>
        <Button variant="primary" onClick={() => { setShowForm(!showForm); setForm(EMPTY); }}>
          <i className="ti ti-plus" /> New Org
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-reveal mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Card 1: Organisation Details */}
            <Card>
              <CardTitle>Organisation Details</CardTitle>
              <div className="space-y-4">
                <div>
                  <label htmlFor="sa-org-name" className="label">Organisation Name *</label>
                  <input
                    id="sa-org-name"
                    className="input"
                    placeholder="e.g. Logitask Mumbai"
                    value={form.name}
                    onChange={set("name")}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="sa-org-code" className="label">Site Code *</label>
                  <input
                    id="sa-org-code"
                    className="input font-mono"
                    placeholder="e.g. MUM-001"
                    value={form.siteCode}
                    onChange={(e) => setForm((f) => ({ ...f, siteCode: e.target.value.toUpperCase() }))}
                    pattern="[A-Z0-9\-]+"
                    maxLength={20}
                    required
                  />
                  <p className="text-xs text-muted mt-1">Alphanumeric + hyphens, must be unique across all orgs</p>
                </div>
              </div>
            </Card>

            {/* Card 2: Organisation Admin */}
            <Card>
              <CardTitle>Organisation Admin</CardTitle>
              <div className="space-y-4">
                <div>
                  <label htmlFor="sa-admin-name" className="label">Admin Name *</label>
                  <input
                    id="sa-admin-name"
                    className="input"
                    placeholder="e.g. Rajesh Sharma"
                    value={form.adminName}
                    onChange={set("adminName")}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="sa-admin-email" className="label">Admin Email *</label>
                  <input
                    id="sa-admin-email"
                    type="email"
                    className="input"
                    placeholder="e.g. admin@logitask.in"
                    value={form.adminEmail}
                    onChange={set("adminEmail")}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="sa-admin-password" className="label">Password *</label>
                  <div className="flex gap-2">
                    <input
                      id="sa-admin-password"
                      type="text"
                      className="input font-mono flex-1"
                      placeholder="Min 8 characters"
                      value={form.password}
                      onChange={set("password")}
                      minLength={8}
                      required
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, password: genPassword() }))}
                      aria-label="Generate random password"
                    >
                      <i className="ti ti-refresh" /> Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted mt-1">Share this with the Admin after creation.</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={createMut.isPending}>
              <i className="ti ti-circle-check" />
              {createMut.isPending ? "Creating…" : "Create Organisation & Admin"}
            </Button>
            <Button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <Card>
        <CardTitle>All Organisations</CardTitle>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Site Code</th>
                <th>Admin</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id}>
                  <td className="font-medium">{org.name}</td>
                  <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{org.siteCode}</span></td>
                  <td>
                    {org.users?.length > 0 ? (
                      <div>
                        <div className="text-sm font-medium">{org.users[0].name}</div>
                        {org.users.length > 1 && (
                          <div className="text-xs text-muted">+{org.users.length - 1} more</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted italic">None</span>
                    )}
                  </td>
                  <td><Badge status={org.isActive ? "Active" : "Inactive"} /></td>
                  <td className="hidden sm:table-cell">{formatDate(org.createdAt)}</td>
                  <td>
                    <button
                      className={`text-xs font-medium ${org.isActive ? "text-danger" : "text-success"}`}
                      onClick={() => setConfirmOrg(org)}
                      disabled={updateMut.isPending}
                      aria-label={org.isActive ? `Disable ${org.name}` : `Enable ${org.name}`}
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

      <ConfirmDialog
        open={!!confirmOrg}
        title={confirmOrg?.isActive ? `Disable "${confirmOrg?.name}"?` : `Enable "${confirmOrg?.name}"?`}
        message={confirmOrg?.isActive
          ? "All users in this organisation will lose access immediately."
          : "This organisation and its users will regain access."}
        confirmLabel={confirmOrg?.isActive ? "Disable Organisation" : "Enable Organisation"}
        variant={confirmOrg?.isActive ? "danger" : "success"}
        loading={updateMut.isPending}
        onConfirm={() => {
          updateMut.mutate({ id: confirmOrg.id, body: { isActive: !confirmOrg.isActive } });
          setConfirmOrg(null);
        }}
        onCancel={() => setConfirmOrg(null)}
      />
    </div>
  );
}
