import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import api from "../../services/api";
import { userService } from "../../services/userService";
import Card, { CardTitle } from "../../components/common/Card";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import FormField, { inputClass, selectClass } from "../../components/common/FormField";
import { PageSpinner } from "../../components/common/Spinner";
import { genPassword } from "../../utils/formatters";
import { ROLE_LABELS } from "../../constants/roles";

const Avatar = ({ name }) => {
  const initials = name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-accent2 flex items-center justify-center text-xs font-bold text-accent">
      {initials}
    </div>
  );
};

const ROLES = ["Admin", "Engineer", "Team_Leader", "Store_Manager"];

export default function AdminUserRegistry() {
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Engineer", password: "" });
  const [engSearch, setEngSearch] = useState("");

  const { data: usersRes, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get("/users").then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => userService.create(data),
    onSuccess: () => {
      toast.success("User added successfully!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUser({ name: "", email: "", role: "Engineer", password: "" });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to add user"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, newPassword }) => {
      await userService.update(id, { name: data.name, role: data.role });
      if (newPassword) await userService.resetPassword(id, { password: newPassword });
    },
    onSuccess: () => {
      toast.success("User updated!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Update failed"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }) => userService.updateStatus(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? "User activated" : "User deactivated");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Status update failed"),
  });

  const handleCreate = () => {
    if (!newUser.name || !newUser.email) { toast.error("Enter name and email"); return; }
    if (!newUser.password) { toast.error("Enter a password"); return; }
    if (newUser.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    createMutation.mutate(newUser);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({ name: user.name, role: user.role, newPassword: "" });
  };

  const handleSave = () => {
    if (!editForm.name) { toast.error("Name cannot be empty"); return; }
    if (editForm.newPassword && editForm.newPassword.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    updateMutation.mutate({ id: editUser.id, data: editForm, newPassword: editForm.newPassword });
  };

  if (isLoading) return <PageSpinner />;

  const users = usersRes || [];
  const admins = users.filter((u) => u.role === "Admin");
  const engineers = users.filter((u) => u.role === "Engineer");
  const q = engSearch.toLowerCase();
  const filteredEngineers = q
    ? engineers.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : engineers;

  const UserRow = ({ u }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2">
        <Avatar name={u.name} />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{u.name}</span>
            {!u.isActive && (
              <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200 px-1 py-0.5 rounded">
                INACTIVE
              </span>
            )}
          </div>
          <div className="text-xs text-muted">{u.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
          <i className="ti ti-edit" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => statusMutation.mutate({ id: u.id, isActive: !u.isActive })}
          disabled={statusMutation.isPending}
          title={u.isActive ? "Deactivate user" : "Activate user"}
        >
          <i className={u.isActive ? "ti ti-ban text-danger" : "ti ti-circle-check text-success"} />
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-5"><h1 className="text-xl font-bold">User Registry</h1></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardTitle>Add New User</CardTitle>
          <FormField label="Full Name">
            <input
              type="text"
              className={inputClass}
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="Full name"
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              className={inputClass}
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="user@company.com"
            />
          </FormField>
          <FormField label="Role">
            <select className={selectClass} value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </FormField>
          <FormField label="Password">
            <div className="flex gap-2">
              <input
                type="text"
                className={inputClass}
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Min 8 characters"
              />
              <Button size="sm" onClick={() => setNewUser({ ...newUser, password: genPassword() })}>
                <i className="ti ti-refresh" />
              </Button>
            </div>
          </FormField>
          <Button variant="primary" onClick={handleCreate} disabled={createMutation.isPending}>
            <i className="ti ti-user-plus" />
            {createMutation.isPending ? "Adding..." : "Add User"}
          </Button>
        </Card>

        <Card>
          <CardTitle>Admins &amp; Staff</CardTitle>
          {admins.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Admins</div>
              {admins.map((u) => <UserRow key={u.id} u={u} />)}
            </div>
          )}
          {["Team_Leader", "Store_Manager"].map((role) => {
            const roleUsers = users.filter((u) => u.role === role);
            return (
              <div key={role} className="mb-3 last:mb-0">
                <div className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">{ROLE_LABELS[role]}</div>
                {roleUsers.length === 0
                  ? <div className="text-xs text-muted py-1">None</div>
                  : roleUsers.map((u) => <UserRow key={u.id} u={u} />)}
              </div>
            );
          })}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text">Engineers ({engineers.length})</h3>
          <input
            type="text"
            value={engSearch}
            onChange={(e) => setEngSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="text-xs border border-border rounded-md px-2.5 py-1.5 outline-none focus:border-accent w-52"
          />
        </div>
        <div className="overflow-x-auto tbl">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {filteredEngineers.length === 0 && (
                <tr><td colSpan={4} className="text-center text-muted py-4 text-xs">No engineers match "{engSearch}"</td></tr>
              )}
              {filteredEngineers.map((eng) => (
                <tr key={eng.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={eng.name} />
                      <strong>{eng.name}</strong>
                    </div>
                  </td>
                  <td className="text-muted text-xs">{eng.email}</td>
                  <td>
                    <span className={`text-xs font-semibold ${eng.isActive ? "text-success" : "text-muted"}`}>
                      {eng.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(eng)}>
                        <i className="ti ti-edit" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => statusMutation.mutate({ id: eng.id, isActive: !eng.isActive })}
                        disabled={statusMutation.isPending}
                      >
                        {eng.isActive
                          ? <><i className="ti ti-ban text-danger" /> Disable</>
                          : <><i className="ti ti-circle-check text-success" /> Enable</>}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit User — ${editUser?.name}`}>
        <FormField label="Full Name">
          <input
            type="text"
            className={inputClass}
            value={editForm.name || ""}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
        </FormField>
        <FormField label="Email">
          <input className={inputClass} value={editUser?.email || ""} disabled style={{ opacity: 0.6 }} />
        </FormField>
        <FormField label="Role">
          <select className={selectClass} value={editForm.role || ""} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </FormField>
        <hr className="border-border my-3" />
        <FormField label="New Password (leave blank to keep current)">
          <div className="flex gap-2">
            <input
              type="text"
              className={inputClass}
              value={editForm.newPassword || ""}
              onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
              placeholder="New password..."
            />
            <Button size="sm" onClick={() => setEditForm({ ...editForm, newPassword: genPassword() })}>
              <i className="ti ti-refresh" />
            </Button>
          </div>
        </FormField>
        <div className="flex gap-2 justify-end mt-2">
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={updateMutation.isPending}>
            <i className="ti ti-device-floppy" /> Save Changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}
